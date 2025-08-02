// generateSnapshot.js
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname);
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const OUTPUT = path.join(PROJECT_ROOT, 'snapshot.md');

const SUPPORTED_EXT = ['.ts', '.js'];
const IGNORED_DIRS = ['node_modules', '.git', 'dist', 'coverage'];

const EXTRA_FILES = [
    { path: '.env', label: '.env' },
    { path: 'prisma/schema.prisma', label: 'prisma/schema.prisma' },
    { path: 'package.json', label: 'package.json' }
];

function scanDir(dir, baseDir) {
    const results = [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (IGNORED_DIRS.includes(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
            results.push(...scanDir(fullPath, baseDir));
        } else if (SUPPORTED_EXT.includes(path.extname(entry.name))) {
            results.push(relativePath);
        }
    }

    return results;
}

function generateTree(dir, prefix = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
        .filter(e => !IGNORED_DIRS.includes(e.name));

    const lines = [];

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const isLast = i === entries.length - 1;
        const pointer = isLast ? '└── ' : '├── ';
        const nextPrefix = prefix + (isLast ? '    ' : '│   ');
        const fullPath = path.join(dir, entry.name);

        lines.push(`${prefix}${pointer}${entry.name}`);

        if (entry.isDirectory()) {
            lines.push(...generateTree(fullPath, nextPrefix));
        }
    }

    return lines;
}

function generateMarkdown(codeFiles, extraFiles) {
    let md = `# 🧾 Project Snapshot\n\n`;
    md += `> Generated at \`${new Date().toISOString()}\`\n\n`;

    md += `## 📁 Directory Structure (excluding node_modules, .git, dist)\n\n`;
    md += '```\n';
    md += '.\n';
    md += generateTree(PROJECT_ROOT).join('\n');
    md += '\n```\n\n';

    for (const relativePath of codeFiles) {
        const fullPath = path.join(SRC_DIR, relativePath);
        const content = fs.readFileSync(fullPath, 'utf-8');

        md += `## \`src/${relativePath}\`\n\n`;
        md += '```ts\n';
        md += content.trim() + '\n';
        md += '```\n\n';
    }

    for (const file of extraFiles) {
        const fullPath = path.join(PROJECT_ROOT, file.path);
        if (!fs.existsSync(fullPath)) continue;

        const content = fs.readFileSync(fullPath, 'utf-8');
        const ext = path.extname(file.path) === '.json' ? 'json' : '';
        md += `## \`${file.label}\`\n\n`;
        md += `\`\`\`${ext}\n`;
        md += content.trim() + '\n';
        md += '```\n\n';
    }

    return md;
}

function runSnapshot() {
    const codeFiles = scanDir(SRC_DIR, SRC_DIR);
    const markdown = generateMarkdown(codeFiles, EXTRA_FILES);
    fs.writeFileSync(OUTPUT, markdown, 'utf-8');
    console.log(`✅ Snapshot saved to ${OUTPUT}`);
}

runSnapshot();
