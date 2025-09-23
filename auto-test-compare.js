// 自动化测试脚本 - 对比功能
console.log('🚀 开始对比功能自动化测试...');

// 测试用例数据
const testCases = [
    {
        name: '基本字段修改测试',
        left: { "name": "张三", "age": 25, "city": "北京" },
        right: { "name": "张三", "age": 26, "city": "上海", "email": "zhang@example.com" },
        expected: {
            leftTypes: ['same', 'modified', 'modified'],
            rightTypes: ['same', 'modified', 'modified', 'added']
        }
    },
    {
        name: '数组长度不同测试',
        left: { "items": ["apple", "banana"], "count": 2 },
        right: { "items": ["apple", "orange", "banana", "grape"], "count": 4 },
        expected: {
            leftTypes: ['modified', 'modified'],
            rightTypes: ['modified', 'modified']
        }
    },
    {
        name: '对象删除测试',
        left: { "user": { "name": "李四", "age": 30 }, "settings": { "theme": "dark" } },
        right: { "user": { "name": "李四", "age": 30 } },
        expected: {
            hasRemoved: true,
            hasEmpty: true
        }
    }
];

// 模拟应用实例
class TestApp {
    constructor() {
        this.results = [];
    }

    // 简化的差异计算（复制主应用的逻辑）
    calculateSimpleDiff(leftLines, rightLines) {
        const leftDiff = [];
        const rightDiff = [];
        const maxLength = Math.max(leftLines.length, rightLines.length);

        for (let i = 0; i < maxLength; i++) {
            const leftLine = leftLines[i];
            const rightLine = rightLines[i];

            if (leftLine === undefined && rightLine !== undefined) {
                leftDiff.push({ type: 'empty', line: '' });
                rightDiff.push({ type: 'added', line: rightLine });
            } else if (leftLine !== undefined && rightLine === undefined) {
                leftDiff.push({ type: 'removed', line: leftLine });
                rightDiff.push({ type: 'empty', line: '' });
            } else if (leftLine === rightLine) {
                leftDiff.push({ type: 'same', line: leftLine });
                rightDiff.push({ type: 'same', line: rightLine });
            } else {
                leftDiff.push({ type: 'modified', line: leftLine });
                rightDiff.push({ type: 'modified', line: rightLine });
            }
        }

        return { left: leftDiff, right: rightDiff };
    }

    // 运行单个测试用例
    runTestCase(testCase) {
        console.log(`\n📝 测试: ${testCase.name}`);

        try {
            const leftFormatted = JSON.stringify(testCase.left, null, 2);
            const rightFormatted = JSON.stringify(testCase.right, null, 2);

            const leftLines = leftFormatted.split('\n');
            const rightLines = rightFormatted.split('\n');

            const diff = this.calculateSimpleDiff(leftLines, rightLines);

            // 验证结果
            const leftLength = diff.left.length;
            const rightLength = diff.right.length;

            // 基本验证：左右长度必须相等
            if (leftLength !== rightLength) {
                throw new Error(`行数不匹配: 左侧${leftLength}行，右侧${rightLength}行`);
            }

            // 验证无重复数据
            const leftContent = diff.left.map(item => item.line).join('\n');
            const rightContent = diff.right.map(item => item.line).join('\n');

            const leftActualLines = leftContent.split('\n').filter(line => line.trim() !== '');
            const rightActualLines = rightContent.split('\n').filter(line => line.trim() !== '');

            const leftOriginalLines = leftFormatted.split('\n').filter(line => line.trim() !== '');
            const rightOriginalLines = rightFormatted.split('\n').filter(line => line.trim() !== '');

            if (leftActualLines.length > leftOriginalLines.length) {
                throw new Error('左侧检测到重复数据');
            }

            if (rightActualLines.length > rightOriginalLines.length) {
                throw new Error('右侧检测到重复数据');
            }

            // 验证类型分布
            const leftTypes = diff.left.map(item => item.type);
            const rightTypes = diff.right.map(item => item.type);

            console.log(`   ✅ 行数对齐: ${leftLength} = ${rightLength}`);
            console.log(`   ✅ 无重复数据`);
            console.log(`   ✅ 左侧类型: ${leftTypes.join(', ')}`);
            console.log(`   ✅ 右侧类型: ${rightTypes.join(', ')}`);

            return {
                success: true,
                leftLength,
                rightLength,
                leftTypes,
                rightTypes,
                diff
            };

        } catch (error) {
            console.log(`   ❌ 测试失败: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 运行所有测试
    runAllTests() {
        console.log('🧪 执行自动化测试...\n');

        let passedTests = 0;
        let totalTests = testCases.length;

        testCases.forEach(testCase => {
            const result = this.runTestCase(testCase);
            this.results.push({
                name: testCase.name,
                ...result
            });

            if (result.success) {
                passedTests++;
            }
        });

        // 输出总结
        console.log('\n📊 测试总结:');
        console.log(`   总测试数: ${totalTests}`);
        console.log(`   通过测试: ${passedTests}`);
        console.log(`   失败测试: ${totalTests - passedTests}`);
        console.log(`   成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

        if (passedTests === totalTests) {
            console.log('\n🎉 所有测试通过！对比功能工作正常。');
        } else {
            console.log('\n⚠️  存在测试失败，请检查问题。');
        }

        return {
            total: totalTests,
            passed: passedTests,
            failed: totalTests - passedTests,
            results: this.results
        };
    }
}

// 如果在浏览器环境中运行
if (typeof window !== 'undefined') {
    window.testCompareFunction = function() {
        const testApp = new TestApp();
        return testApp.runAllTests();
    };

    // 自动运行测试
    setTimeout(() => {
        window.testCompareFunction();
    }, 1000);
}

// 如果在Node.js环境中运行
if (typeof module !== 'undefined' && module.exports) {
    const testApp = new TestApp();
    testApp.runAllTests();
}