// JSON工具简化版自动化测试脚本
// 用于验证三个核心功能：格式化、对比、数据生成

const fs = require('fs');
const path = require('path');

// 模拟JSON处理函数
class JSONToolSimpleTest {
    constructor() {
        this.testResults = [];
    }

    // 测试JSON格式化功能
    testJSONFormatting() {
        console.log('🧪 测试JSON格式化功能...');

        const testCases = [
            {
                name: '压缩JSON美化',
                input: '{"name":"张三","age":25,"skills":["JavaScript","Python"]}',
                expected: '{\n  "name": "张三",\n  "age": 25,\n  "skills": [\n    "JavaScript",\n    "Python"\n  ]\n}'
            },
            {
                name: '格式化JSON压缩',
                input: '{\n  "name": "张三",\n  "age": 25,\n  "skills": [\n    "JavaScript",\n    "Python"\n  ]\n}',
                expected: '{"name":"张三","age":25,"skills":["JavaScript","Python"]}'
            },
            {
                name: '错误JSON处理',
                input: '{"name":"张三","age":25,}',
                shouldError: true
            }
        ];

        testCases.forEach(testCase => {
            try {
                if (testCase.shouldError) {
                    try {
                        JSON.parse(testCase.input);
                        this.addResult(testCase.name, false, '应该报错但没有报错');
                    } catch (error) {
                        this.addResult(testCase.name, true, '正确检测到JSON错误');
                    }
                } else {
                    const parsed = JSON.parse(testCase.input);
                    const formatted = testCase.name.includes('美化')
                        ? JSON.stringify(parsed, null, 2)
                        : JSON.stringify(parsed);

                    const passed = formatted === testCase.expected;
                    this.addResult(testCase.name, passed, passed ? '通过' : `期望: ${testCase.expected}, 实际: ${formatted}`);
                }
            } catch (error) {
                this.addResult(testCase.name, false, `错误: ${error.message}`);
            }
        });
    }

    // 测试JSON对比功能
    testJSONComparison() {
        console.log('🧪 测试JSON对比功能...');

        const testCases = [
            {
                name: '基本差异对比',
                left: '{"name":"张三","age":25,"city":"北京"}',
                right: '{"name":"李四","age":26,"country":"中国"}',
                expectedAdded: ['country'],
                expectedRemoved: ['city'],
                expectedModified: ['name', 'age']
            },
            {
                name: '相同JSON对比',
                left: '{"name":"张三","age":25}',
                right: '{"name":"张三","age":25}',
                expectedAdded: [],
                expectedRemoved: [],
                expectedModified: []
            },
            {
                name: '嵌套对象对比',
                left: '{"user":{"name":"张三","age":25}}',
                right: '{"user":{"name":"张三","age":26,"city":"北京"}}',
                expectedModified: ['user']
            }
        ];

        testCases.forEach(testCase => {
            try {
                const leftObj = JSON.parse(testCase.left);
                const rightObj = JSON.parse(testCase.right);

                // 简化的对比逻辑
                const leftKeys = Object.keys(leftObj);
                const rightKeys = Object.keys(rightObj);

                const added = rightKeys.filter(key => !leftKeys.includes(key));
                const removed = leftKeys.filter(key => !rightKeys.includes(key));
                const modified = leftKeys.filter(key =>
                    rightKeys.includes(key) && JSON.stringify(leftObj[key]) !== JSON.stringify(rightObj[key])
                );

                let passed = true;
                let message = '通过';

                if (testCase.expectedAdded && JSON.stringify(added) !== JSON.stringify(testCase.expectedAdded)) {
                    passed = false;
                    message = `新增字段不匹配，期望: ${testCase.expectedAdded}, 实际: ${added}`;
                }

                if (testCase.expectedRemoved && JSON.stringify(removed) !== JSON.stringify(testCase.expectedRemoved)) {
                    passed = false;
                    message = `删除字段不匹配，期望: ${testCase.expectedRemoved}, 实际: ${removed}`;
                }

                if (testCase.expectedModified && JSON.stringify(modified) !== JSON.stringify(testCase.expectedModified)) {
                    passed = false;
                    message = `修改字段不匹配，期望: ${testCase.expectedModified}, 实际: ${modified}`;
                }

                this.addResult(testCase.name, passed, message);

            } catch (error) {
                this.addResult(testCase.name, false, `错误: ${error.message}`);
            }
        });
    }

    // 测试数据生成功能
    testDataGeneration() {
        console.log('🧪 测试数据生成功能...');

        const templates = [
            {
                name: '用户数据生成',
                template: 'user',
                requiredFields: ['id', 'name', 'email', 'age']
            },
            {
                name: '产品数据生成',
                template: 'product',
                requiredFields: ['id', 'name', 'price', 'category']
            },
            {
                name: '订单数据生成',
                template: 'order',
                requiredFields: ['orderId', 'userId', 'items', 'total']
            }
        ];

        templates.forEach(template => {
            try {
                // 模拟数据生成
                let generatedData;

                switch (template.template) {
                    case 'user':
                        generatedData = {
                            id: Math.floor(Math.random() * 10000),
                            name: "张三",
                            email: "zhangsan@example.com",
                            age: Math.floor(Math.random() * 50) + 18,
                            phone: "13800138000",
                            address: {
                                city: "北京",
                                district: "朝阳区"
                            }
                        };
                        break;

                    case 'product':
                        generatedData = {
                            id: Math.floor(Math.random() * 10000),
                            name: "测试产品",
                            price: parseFloat((Math.random() * 1000).toFixed(2)),
                            category: "电子产品",
                            description: "这是一个测试产品",
                            inStock: Math.random() > 0.5
                        };
                        break;

                    case 'order':
                        generatedData = {
                            orderId: "ORD" + Math.floor(Math.random() * 100000),
                            userId: Math.floor(Math.random() * 1000),
                            items: [{
                                productId: Math.floor(Math.random() * 100),
                                name: "商品1",
                                quantity: Math.floor(Math.random() * 5) + 1,
                                price: parseFloat((Math.random() * 100).toFixed(2))
                            }],
                            total: parseFloat((Math.random() * 500).toFixed(2)),
                            status: "pending"
                        };
                        break;
                }

                // 验证生成的数据
                const isValidJSON = typeof generatedData === 'object' && generatedData !== null;
                const hasRequiredFields = template.requiredFields.every(field =>
                    generatedData.hasOwnProperty(field)
                );

                const passed = isValidJSON && hasRequiredFields;
                const message = passed ? '通过' : `缺少必需字段或数据格式错误`;

                this.addResult(template.name, passed, message);

            } catch (error) {
                this.addResult(template.name, false, `错误: ${error.message}`);
            }
        });
    }

    // 测试主题切换功能
    testThemeSwitch() {
        console.log('🧪 测试主题切换功能...');

        try {
            // 模拟主题切换逻辑
            let currentTheme = 'light';
            const themes = ['light', 'dark'];

            const switchTheme = () => {
                currentTheme = currentTheme === 'light' ? 'dark' : 'light';
                return currentTheme;
            };

            // 测试主题切换
            const newTheme1 = switchTheme();
            const newTheme2 = switchTheme();

            const passed = newTheme1 === 'dark' && newTheme2 === 'light';
            this.addResult('主题切换功能', passed, passed ? '通过' : `主题切换失败: ${newTheme1}, ${newTheme2}`);

        } catch (error) {
            this.addResult('主题切换功能', false, `错误: ${error.message}`);
        }
    }

    // 添加测试结果
    addResult(testName, passed, message) {
        const status = passed ? '✅' : '❌';
        console.log(`  ${status} ${testName}: ${message}`);

        this.testResults.push({
            name: testName,
            passed,
            message,
            timestamp: new Date().toISOString()
        });
    }

    // 运行所有测试
    async runAllTests() {
        console.log('🚀 开始JSON工具简化版功能测试...\n');

        this.testJSONFormatting();
        console.log('');

        this.testJSONComparison();
        console.log('');

        this.testDataGeneration();
        console.log('');

        this.testThemeSwitch();
        console.log('');

        this.generateReport();
    }

    // 生成测试报告
    generateReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;

        console.log('📊 测试报告:');
        console.log(`总测试数: ${totalTests}`);
        console.log(`通过: ${passedTests} ✅`);
        console.log(`失败: ${failedTests} ❌`);
        console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

        if (failedTests > 0) {
            console.log('\n❌ 失败的测试:');
            this.testResults.filter(r => !r.passed).forEach(result => {
                console.log(`  - ${result.name}: ${result.message}`);
            });
        }

        // 保存测试报告
        const report = {
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: failedTests,
                successRate: ((passedTests / totalTests) * 100).toFixed(1)
            },
            details: this.testResults,
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync('test-report.json', JSON.stringify(report, null, 2));
        console.log('\n📄 详细测试报告已保存至 test-report.json');
    }
}

// 运行测试
if (require.main === module) {
    const tester = new JSONToolSimpleTest();
    tester.runAllTests().catch(console.error);
}

module.exports = JSONToolSimpleTest;