const fs = require('fs');

function replaceInFile(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf8');
    for (const [regex, newStr] of replacements) {
        if (!regex.test(content)) {
            console.error(`Failed to match regex in ${filePath}:\n${regex}`);
        } else {
            content = content.replace(regex, newStr);
        }
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`${filePath} patched successfully.`);
}

// 1. LayoutManager.js
replaceInFile('chrome-extension/js/managers/LayoutManager.js', [
    [
        /\|\| 'glm-4-flash'/g,
        `|| 'glm-5.1'`
    ],
    [
        /例如: glm-4-flash/g,
        `例如: glm-5.1`
    ],
    [
        /默认为 glm-4-flash。如果需要更高精度，可填入其他模型名称（如 glm-4）。/g,
        `默认为 glm-5.1。如果需要更高精度，可填入其他模型名称（如 glm-4）。`
    ]
]);

// 2. FormatterManager.js
replaceInFile('chrome-extension/js/managers/FormatterManager.js', [
    [
        /\|\| 'glm-4-flash'/g,
        `|| 'glm-5.1'`
    ],
    [
        /https:\/\/open\.bigmodel\.cn\/api\/paas\/v4\/chat\/completions/g,
        `https://open.bigmodel.cn/api/coding/paas/v4/chat/completions`
    ]
]);

// 3. CompareManager.js
replaceInFile('chrome-extension/js/managers/CompareManager.js', [
    [
        /\|\| 'glm-4-flash'/g,
        `|| 'glm-5.1'`
    ],
    [
        /https:\/\/open\.bigmodel\.cn\/api\/paas\/v4\/chat\/completions/g,
        `https://open.bigmodel.cn/api/coding/paas/v4/chat/completions`
    ]
]);

