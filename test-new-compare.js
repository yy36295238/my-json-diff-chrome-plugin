// 新对比功能测试脚本
console.log('🚀 开始测试新的JSON对比功能...');

// 测试用例数据
const testCases = [
    {
        name: '基本字段修改测试',
        left: { "name": "张三", "age": 25, "city": "北京" },
        right: { "name": "张三", "age": 26, "city": "上海", "email": "zhang@example.com" },
        expectedDiffs: [
            { path: 'age', type: 'modified' },
            { path: 'city', type: 'modified' },
            { path: 'email', type: 'added' }
        ]
    },
    {
        name: '嵌套对象测试',
        left: {
            "user": { "name": "李四", "age": 30 },
            "settings": { "theme": "dark" }
        },
        right: {
            "user": { "name": "李四", "age": 31 },
            "config": { "lang": "zh" }
        },
        expectedDiffs: [
            { path: 'user.age', type: 'modified' },
            { path: 'settings', type: 'removed' },
            { path: 'config', type: 'added' }
        ]
    },
    {
        name: '数组测试',
        left: { "items": ["apple", "banana"] },
        right: { "items": ["apple", "orange", "banana"] },
        expectedDiffs: [
            { path: 'items[1]', type: 'modified' },
            { path: 'items[2]', type: 'added' }
        ]
    }
];

// 模拟新的对比应用
class NewCompareTest {
    constructor() {
        this.results = [];
    }

    // 复制主应用的结构化差异算法
    calculateStructuralDiff(left, right, path = '') {
        const differences = [];

        // 处理null值
        if (left === null || right === null) {
            if (left !== right) {
                differences.push({
                    path: path || 'root',
                    type: left === null ? 'added' : 'removed',
                    leftValue: left,
                    rightValue: right
                });
            }
            return differences;
        }

        // 处理基本类型
        if (typeof left !== 'object' || typeof right !== 'object') {
            if (left !== right) {
                differences.push({
                    path: path || 'root',
                    type: 'modified',
                    leftValue: left,
                    rightValue: right
                });
            }
            return differences;
        }

        // 处理数组
        if (Array.isArray(left) && Array.isArray(right)) {
            const maxLength = Math.max(left.length, right.length);
            for (let i = 0; i < maxLength; i++) {
                const currentPath = path ? `${path}[${i}]` : `[${i}]`;

                if (i >= left.length) {
                    differences.push({
                        path: currentPath,
                        type: 'added',
                        leftValue: undefined,
                        rightValue: right[i]
                    });
                } else if (i >= right.length) {
                    differences.push({
                        path: currentPath,
                        type: 'removed',
                        leftValue: left[i],
                        rightValue: undefined
                    });
                } else {
                    differences.push(...this.calculateStructuralDiff(left[i], right[i], currentPath));
                }
            }
            return differences;
        }

        // 处理对象
        if (typeof left === 'object' && typeof right === 'object') {
            const allKeys = new Set([...Object.keys(left), ...Object.keys(right)]);

            for (const key of allKeys) {
                const currentPath = path ? `${path}.${key}` : key;

                if (!(key in left)) {
                    differences.push({
                        path: currentPath,
                        type: 'added',
                        leftValue: undefined,
                        rightValue: right[key]
                    });
                } else if (!(key in right)) {
                    differences.push({
                        path: currentPath,
                        type: 'removed',
                        leftValue: left[key],
                        rightValue: undefined
                    });
                } else {
                    differences.push(...this.calculateStructuralDiff(left[key], right[key], currentPath));
                }
            }
        }

        return differences;
    }

    // 运行单个测试用例
    runTestCase(testCase) {
        console.log(`\n📝 测试: ${testCase.name}`);

        try {
            const diff = this.calculateStructuralDiff(testCase.left, testCase.right);

            console.log(`   📊 发现 ${diff.length} 个差异:`);
            diff.forEach(d => {
                console.log(`      ${d.type}: ${d.path}`);
            });

            // 验证是否包含预期的差异
            let foundExpected = 0;
            for (const expected of testCase.expectedDiffs) {
                const found = diff.find(d => d.path === expected.path && d.type === expected.type);
                if (found) {
                    foundExpected++;
                    console.log(`   ✅ 找到预期差异: ${expected.type} - ${expected.path}`);
                } else {
                    console.log(`   ❌ 未找到预期差异: ${expected.type} - ${expected.path}`);
                }
            }

            const accuracy = (foundExpected / testCase.expectedDiffs.length) * 100;
            console.log(`   📈 准确率: ${accuracy.toFixed(1)}%`);

            return {
                success: accuracy === 100,
                accuracy,
                foundDiffs: diff.length,
                expectedDiffs: testCase.expectedDiffs.length,
                foundExpected
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
        console.log('🧪 执行新对比功能测试...\n');

        let passedTests = 0;
        let totalAccuracy = 0;
        const totalTests = testCases.length;

        testCases.forEach(testCase => {
            const result = this.runTestCase(testCase);
            this.results.push({
                name: testCase.name,
                ...result
            });

            if (result.success) {
                passedTests++;
            }

            if (result.accuracy) {
                totalAccuracy += result.accuracy;
            }
        });

        const avgAccuracy = totalAccuracy / totalTests;

        // 输出总结
        console.log('\n📊 测试总结:');
        console.log(`   总测试数: ${totalTests}`);
        console.log(`   通过测试: ${passedTests}`);
        console.log(`   失败测试: ${totalTests - passedTests}`);
        console.log(`   成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
        console.log(`   平均准确率: ${avgAccuracy.toFixed(1)}%`);

        if (passedTests === totalTests && avgAccuracy >= 95) {
            console.log('\n🎉 新对比功能测试通过！结构化对比工作正常。');
        } else if (avgAccuracy >= 80) {
            console.log('\n⚠️  部分测试需要优化，但基本功能正常。');
        } else {
            console.log('\n❌ 测试未达标，需要进一步修复。');
        }

        return {
            total: totalTests,
            passed: passedTests,
            avgAccuracy,
            results: this.results
        };
    }
}

// 执行测试
if (typeof window !== 'undefined') {
    // 浏览器环境
    window.testNewCompareFunction = function() {
        const testApp = new NewCompareTest();
        return testApp.runAllTests();
    };

    setTimeout(() => {
        window.testNewCompareFunction();
    }, 1000);
} else {
    // Node.js环境
    const testApp = new NewCompareTest();
    testApp.runAllTests();
}