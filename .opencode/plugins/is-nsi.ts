// Порт zcode-хуков PostToolUse на OpenCode V2 (плагин):
//   1) prettier --write по изменённым файлам фронта ias (*.ts, *.html, *.less);
//   2) зеркало .zcode/skills -> .opencode/skills при правке скилов.
// Любой сбой глушится: автоматика не должна блокировать работу агента.
// Диагностика пишется в .opencode/plugin-debug.log (только ошибки).
// Выключить: убрать/переименовать файл плагина — в OpenCode нет hooks.enabled.

import { spawn } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, rmSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, resolve } from 'node:path';

const FORMATTABLE = new Set(['.ts', '.html', '.less']);
const PRETTIER_TIMEOUT_MS = 10_000;
// Форматируем только инструменты, которые пишут файл: после read/grep prettier не нужен
const EDIT_TOOLS = new Set(['write', 'edit', 'apply_patch', 'multiedit', 'patch']);

const norm = (value) => String(value).replaceAll('\\', '/');

const projectRoot = (ctx) =>
    norm(ctx?.location?.project?.canonical || ctx?.location?.directory || process.cwd());

/** Путь изменённого файла из события tool.execute.after (поле зависит от инструмента). */
function readFilePath(event) {
    const found = [];
    const push = (value) => {
        if (typeof value === 'string' && value.trim() && !found.includes(value)) found.push(value);
    };
    const input = event?.input;
    if (input && typeof input === 'object') {
        for (const key of ['filePath', 'file_path', 'path', 'filename', 'file', 'target']) push(input[key]);
    }
    const result = event?.result;
    if (result && typeof result === 'object') {
        for (const key of ['filePath', 'file_path', 'path']) push(result[key]);
        const metadata = result.metadata;
        if (metadata && typeof metadata === 'object') {
            for (const key of ['filePath', 'file_path', 'path']) push(metadata[key]);
        }
    }
    return found.find((value) => extname(value) !== '') ?? found[0] ?? null;
}

/** Абсолютный путь, если файл существует: событие может прийти с относительным путём. */
function resolveExisting(root, file) {
    const candidates = isAbsolute(file) ? [file] : [resolve(root, file), resolve(file)];
    for (const candidate of candidates) {
        try {
            if (statSync(candidate).isFile()) return norm(candidate);
        } catch {
            // файла нет — пробуем следующий вариант
        }
    }
    return null;
}

function reporter(root) {
    return (message) => {
        try {
            appendFileSync(
                join(root, '.opencode', 'plugin-debug.log'),
                `${new Date().toISOString()} ${message}\n`,
            );
        } catch {
            // диагностика не должна мешать
        }
    };
}

/** Запуск prettier; пробуем node из PATH, затем рантайм самого OpenCode. */
function runPrettier(root, file, report) {
    const prettierBin = join(root, 'src', 'client', 'ias', 'node_modules', 'prettier', 'bin', 'prettier.cjs');
    if (!existsSync(prettierBin)) return Promise.resolve();

    const attempts = ['node', process.execPath].filter((value, index, all) => value && all.indexOf(value) === index);

    const attempt = (index) =>
        new Promise((done) => {
            const command = attempts[index];
            if (!command) return done();
            const child = spawn(command, [prettierBin, '--write', file], {
                cwd: dirname(file),
                stdio: ['ignore', 'ignore', 'pipe'],
                windowsHide: true,
            });
            let stderr = '';
            child.stderr?.on('data', (chunk) => {
                stderr += String(chunk);
            });
            const timer = setTimeout(() => child.kill(), PRETTIER_TIMEOUT_MS);
            child.on('close', (code) => {
                clearTimeout(timer);
                if (code === 0) return done();
                report(`prettier exit=${code} command=${command} file=${file} stderr=${stderr.trim().slice(0, 500)}`);
                attempt(index + 1).then(done);
            });
            child.on('error', (error) => {
                clearTimeout(timer);
                report(`prettier spawn failed command=${command} file=${file} error=${error.message}`);
                attempt(index + 1).then(done);
            });
        });

    return attempt(0);
}

/** Точное зеркало .zcode/skills -> .opencode/skills (как .zcode/hooks/sync-skills.mjs --force). */
function syncSkills(root) {
    const source = join(root, '.zcode', 'skills');
    const destination = join(root, '.opencode', 'skills');
    if (!existsSync(source) || !existsSync(join(root, '.opencode'))) return;
    rmSync(destination, { recursive: true, force: true });
    cpSync(source, destination, { recursive: true });
}

export default {
    id: 'is-nsi',
    async setup(ctx) {
        const root = projectRoot(ctx);
        const report = reporter(root);

        await ctx.tool.hook('execute.after', async (event) => {
            if (event?.status && event.status !== 'completed') return;
            if (!EDIT_TOOLS.has(event?.tool)) return;
            const raw = readFilePath(event);
            if (!raw) return;
            const file = resolveExisting(root, raw);
            if (!file) return;

            if (file.includes('/.zcode/skills/')) {
                try {
                    syncSkills(root);
                } catch (error) {
                    report(`sync-skills failed file=${file} error=${error?.message ?? error}`);
                }
            }

            if (!FORMATTABLE.has(extname(file).toLowerCase())) return;
            if (!file.includes('/src/client/ias/')) return;
            await runPrettier(root, file, report);
        });
    },
};
