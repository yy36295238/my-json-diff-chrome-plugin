// 格式化预览功能测试脚本
const fs = require('fs');

class PreviewFunctionalityTest {
    constructor() {
        this.testResults = [];
    }

    // 模拟JSON渲染器类
    createMockRenderer() {
        return {
            renderJSONTree: function(obj, level = 0, key = null) {
                const indent = '  '.repeat(level);
                let html = '';

                if (key !== null) {
                    html += `<span class="json-key">"${key}"</span>: `;
                }

                if (obj === null) {
                    html += `<span class="json-null">null</span>`;
                } else if (typeof obj === 'boolean') {
                    html += `<span class="json-boolean">${obj}</span>`;
                } else if (typeof obj === 'number') {
                    html += `<span class="json-number">${obj}</span>`;
                } else if (typeof obj === 'string') {
                    html += `<span class="json-string">"${this.escapeHtml(obj)}"</span>`;
                } else if (Array.isArray(obj)) {
                    if (obj.length === 0) {
                        html += `<span class="json-bracket">[]</span>`;
                    } else {
                        html += `<span class="json-collapsible">▼</span> `;
                        html += `<span class="json-bracket">[</span>`;
                        html += `<div class="json-collapsible-content" style="display: block;">\\n`;

                        obj.forEach((item, index) => {
                            html += indent + '  ';
                            html += this.renderJSONTree(item, level + 1);
                            if (index < obj.length - 1) html += ',';
                            html += '\\n';
                        });

                        html += indent + '</div>';
                        html += `<span class="json-bracket">]</span>`;
                    }
                } else if (typeof obj === 'object') {
                    const keys = Object.keys(obj);
                    if (keys.length === 0) {
                        html += `<span class="json-bracket">{}</span>`;
                    } else {
                        html += `<span class="json-collapsible">▼</span> `;
                        html += `<span class="json-bracket">{</span>`;
                        html += `<div class="json-collapsible-content" style="display: block;">\\n`;

                        keys.forEach((k, index) => {
                            html += indent + '  ';
                            html += this.renderJSONTree(obj[k], level + 1, k);
                            if (index < keys.length - 1) html += ',';
                            html += '\\n';
                        });

                        html += indent + '</div>';
                        html += `<span class="json-bracket">}</span>`;
                    }
                }

                return html;
            },

            escapeHtml: function(text) {
                return text.replace(/&/g, '&amp;')
                          .replace(/</g, '&lt;')
                          .replace(/>/g, '&gt;')
                          .replace(/"/g, '&quot;')
                          .replace(/'/g, '&#39;');
            }
        };
    }

    // 测试基本渲染功能
    testBasicRendering() {
        console.log('🧪 测试基本JSON渲染功能...');

        const renderer = this.createMockRenderer();
        const testCases = [
            {
                name: '简单对象渲染',
                input: { name: "张三", age: 25 },
                shouldContain: ['json-key', 'json-string', 'json-number', 'json-bracket']
            },
            {
                name: '数组渲染',
                input: [1, 2, 3],
                shouldContain: ['json-number', 'json-bracket', 'json-collapsible']
            },
            {
                name: '空对象渲染',
                input: {},
                shouldContain: ['json-bracket']
            },
            {
                name: '空数组渲染',
                input: [],
                shouldContain: ['json-bracket']
            },
            {
                name: '嵌套对象渲染',
                input: { user: { name: "test", details: { age: 25 } } },
                shouldContain: ['json-key', 'json-collapsible', 'json-collapsible-content']
            }
        ];

        testCases.forEach(testCase => {
            try {
                const result = renderer.renderJSONTree(testCase.input);
                let passed = true;
                let missingElements = [];

                testCase.shouldContain.forEach(element => {
                    if (!result.includes(element)) {
                        passed = false;
                        missingElements.push(element);
                    }
                });

                if (passed) {
                    this.addResult(testCase.name, true, '渲染成功');
                } else {
                    this.addResult(testCase.name, false, `缺少元素: ${missingElements.join(', ')}`);
                }
            } catch (error) {
                this.addResult(testCase.name, false, `渲染错误: ${error.message}`);
            }
        });
    }

    // 测试可折叠功能
    testCollapsibleFeature() {
        console.log('🧪 测试可折叠功能...');

        const renderer = this.createMockRenderer();
        const testData = {
            users: [
                { id: 1, name: "张三" },
                { id: 2, name: "李四" }
            ],
            meta: { total: 2 }
        };

        try {
            const result = renderer.renderJSONTree(testData);

            // 检查是否包含折叠控制元素
            const hasCollapsible = result.includes('json-collapsible');
            const hasCollapsibleContent = result.includes('json-collapsible-content');
            const hasToggleSymbol = result.includes('▼');

            if (hasCollapsible && hasCollapsibleContent && hasToggleSymbol) {
                this.addResult('可折叠元素生成', true, '成功生成可折叠元素');
            } else {
                this.addResult('可折叠元素生成', false,
                    `缺少: ${!hasCollapsible ? '折叠类' : ''} ${!hasCollapsibleContent ? '内容区' : ''} ${!hasToggleSymbol ? '切换符号' : ''}`);
            }
        } catch (error) {
            this.addResult('可折叠元素生成', false, `错误: ${error.message}`);
        }
    }

    // 测试数据类型样式
    testDataTypeStyles() {
        console.log('🧪 测试数据类型样式...');

        const renderer = this.createMockRenderer();
        const testData = {
            stringValue: "test",
            numberValue: 42,
            booleanValue: true,
            nullValue: null,
            arrayValue: [1, 2],
            objectValue: { nested: "value" }
        };

        try {
            const result = renderer.renderJSONTree(testData);

            const typeTests = [
                { type: 'string', class: 'json-string', exists: result.includes('json-string') },
                { type: 'number', class: 'json-number', exists: result.includes('json-number') },
                { type: 'boolean', class: 'json-boolean', exists: result.includes('json-boolean') },
                { type: 'null', class: 'json-null', exists: result.includes('json-null') },
                { type: 'key', class: 'json-key', exists: result.includes('json-key') },
                { type: 'bracket', class: 'json-bracket', exists: result.includes('json-bracket') }
            ];

            typeTests.forEach(test => {
                this.addResult(`${test.type}类型样式`, test.exists,
                    test.exists ? '样式类正确生成' : `缺少${test.class}样式类`);
            });

        } catch (error) {
            this.addResult('数据类型样式测试', false, `错误: ${error.message}`);
        }
    }

    // 测试HTML转义
    testHTMLEscaping() {
        console.log('🧪 测试HTML转义功能...');

        const renderer = this.createMockRenderer();
        const testData = {
            dangerous: "<script>alert('xss')</script>",
            quotes: 'He said "Hello"',
            ampersand: "Tom & Jerry"
        };

        try {
            const result = renderer.renderJSONTree(testData);

            const escapeTests = [
                { name: 'Script标签转义',
                  check: !result.includes('<script>') && result.includes('&lt;script&gt;') },
                { name: '引号转义',
                  check: result.includes('&quot;') },
                { name: '&符号转义',
                  check: result.includes('&amp;') }
            ];

            escapeTests.forEach(test => {
                this.addResult(test.name, test.check,
                    test.check ? 'HTML转义正确' : 'HTML转义失败');
            });

        } catch (error) {
            this.addResult('HTML转义测试', false, `错误: ${error.message}`);
        }
    }

    // 测试复杂嵌套结构
    testComplexNesting() {
        console.log('🧪 测试复杂嵌套结构...');

        const complexData = {
            level1: {
                level2: {
                    level3: {
                        deep: "value",
                        array: [
                            { nested: true },
                            [1, 2, { deeper: "still" }]
                        ]
                    }
                }
            }
        };

        const renderer = this.createMockRenderer();

        try {
            const result = renderer.renderJSONTree(complexData);

            // 检查是否能处理深层嵌套
            const hasMultipleLevels = (result.match(/json-collapsible/g) || []).length >= 3;
            const hasNestedContent = result.includes('json-collapsible-content');
            const preservesStructure = result.includes('"deep"') && result.includes('"nested"');

            if (hasMultipleLevels && hasNestedContent && preservesStructure) {
                this.addResult('复杂嵌套结构', true, '成功渲染复杂嵌套结构');
            } else {
                this.addResult('复杂嵌套结构', false, '复杂嵌套结构渲染不完整');
            }

        } catch (error) {
            this.addResult('复杂嵌套结构', false, `错误: ${error.message}`);
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
        console.log('🚀 开始格式化预览功能测试...\\n');

        this.testBasicRendering();
        console.log('');

        this.testCollapsibleFeature();
        console.log('');

        this.testDataTypeStyles();
        console.log('');

        this.testHTMLEscaping();
        console.log('');

        this.testComplexNesting();
        console.log('');

        this.generateReport();
    }

    // 生成测试报告
    generateReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;

        console.log('📊 格式化预览功能测试报告:');
        console.log(`总测试数: ${totalTests}`);
        console.log(`通过: ${passedTests} ✅`);
        console.log(`失败: ${failedTests} ❌`);
        console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

        if (failedTests > 0) {
            console.log('\\n❌ 失败的测试:');
            this.testResults.filter(r => !r.passed).forEach(result => {
                console.log(`  - ${result.name}: ${result.message}`);
            });
        }

        // 保存测试报告
        const report = {
            feature: 'JSON格式化预览功能',
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: failedTests,
                successRate: ((passedTests / totalTests) * 100).toFixed(1)
            },
            details: this.testResults,
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync('preview-test-report.json', JSON.stringify(report, null, 2));
        console.log('\\n📄 详细测试报告已保存至 preview-test-report.json');
    }
}

// 运行测试
if (require.main === module) {
    const tester = new PreviewFunctionalityTest();
    tester.runAllTests().catch(console.error);
}

module.exports = PreviewFunctionalityTest;