export class GeneratorManager {
    constructor(app) {
        this.app = app;
        this.currentTemplate = null;
    }

    init() {
        document.querySelectorAll('.template-card').forEach(btn => {
            btn.addEventListener('click', () => this.selectTemplate(btn.dataset.template));
        });

        document.getElementById('generateBtn').addEventListener('click', () => this.generateData());
        document.getElementById('useGenerated').addEventListener('click', () => this.useGeneratedData());
    }

    selectTemplate(templateName) {
        document.querySelectorAll('.template-card').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-template="${templateName}"]`).classList.add('active');
        this.currentTemplate = templateName;
    }

    generateData() {
        if (!this.currentTemplate) return;

        const count = parseInt(document.getElementById('generateCount').value) || 1;
        const generateArray = document.getElementById('generateArray').checked;
        const locale = document.getElementById('localeSelect').value;

        const data = [];
        for (let i = 0; i < count; i++) {
            data.push(this.generateTemplateData(this.currentTemplate, locale));
        }

        const result = (count > 1 || generateArray) ? data : data[0];
        document.getElementById('generatedJson').value = JSON.stringify(result, null, 2);
    }

    generateTemplateData(templateName, locale) {
        const generators = {
            user: () => this.genUser(locale),
            product: () => this.genProduct(locale),
            order: () => this.genOrder(locale),
            address: () => this.genAddress(locale),
            company: () => this.genCompany(locale),
            article: () => this.genArticle(locale),
            api: () => this.genApi(locale),
            config: () => this.genConfig(locale)
        };
        return generators[templateName] ? generators[templateName]() : {};
    }

    // Helpers
    randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    randomBool() { return Math.random() > 0.5; }
    randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    randomDate() { return new Date(Date.now() - Math.random() * 1e10).toISOString(); }
    randomId() { return Math.random().toString(36).substr(2, 9); }

    // Complex Generators
    genUser(locale) {
        const isCN = locale === 'zh_CN';
        const firstNames = isCN ? ['张', '李', '王', '赵', '陈', '刘', '杨', '黄'] : ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer'];
        const lastNames = isCN ? ['伟', '芳', '娜', '敏', '静', '强', '磊', '军'] : ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia'];
        const name = this.randomItem(firstNames) + (isCN ? '' : ' ') + this.randomItem(lastNames);
        
        return {
            id: this.randomInt(10000, 99999),
            username: isCN ? `user_${this.randomInt(1000,9999)}` : `${name.toLowerCase().replace(' ', '.')}${this.randomInt(1,99)}`,
            profile: {
                firstName: isCN ? name[0] : name.split(' ')[0],
                lastName: isCN ? name.substring(1) : name.split(' ')[1],
                displayName: name,
                avatar: `https://example.com/avatars/${this.randomInt(1, 100)}.jpg`,
                gender: this.randomItem(['male', 'female', 'other']),
                birthday: this.randomDate().split('T')[0]
            },
            contact: {
                email: `${isCN ? 'zhang.san' : 'john.doe'}@example.com`,
                phone: isCN ? `138${this.randomInt(10000000, 99999999)}` : `+1-555-${this.randomInt(100, 999)}-${this.randomInt(1000, 9999)}`,
                address: this.genAddress(locale)
            },
            preferences: {
                language: locale,
                timezone: isCN ? 'Asia/Shanghai' : 'America/New_York',
                theme: this.randomItem(['light', 'dark', 'auto']),
                notifications: {
                    email: this.randomBool(),
                    push: this.randomBool(),
                    sms: false
                }
            },
            stats: {
                loginCount: this.randomInt(1, 500),
                lastLogin: this.randomDate(),
                reputationScore: this.randomInt(80, 100)
            },
            roles: this.randomItem([['user'], ['user', 'admin'], ['user', 'editor']]),
            isActive: true
        };
    }

    genProduct(locale) {
        const isCN = locale === 'zh_CN';
        const adjectives = isCN ? ['超级', '智能', '便携', '高性能', '复古'] : ['Super', 'Smart', 'Portable', 'High-performance', 'Vintage'];
        const nouns = isCN ? ['手机', '电脑', '耳机', '手表', '相机'] : ['Phone', 'Laptop', 'Headphones', 'Watch', 'Camera'];
        const productName = this.randomItem(adjectives) + (isCN ? '' : ' ') + this.randomItem(nouns);

        return {
            productId: `PROD-${this.randomId().toUpperCase()}`,
            name: productName,
            sku: `SKU-${this.randomInt(1000, 9999)}`,
            pricing: {
                basePrice: this.randomInt(100, 2000),
                currency: isCN ? 'CNY' : 'USD',
                discount: this.randomInt(0, 20),
                taxRate: 0.08
            },
            stock: {
                warehouse: this.randomItem(['WH-01', 'WH-02', 'WH-CN']),
                quantity: this.randomInt(0, 500),
                status: this.randomItem(['In Stock', 'Low Stock', 'Out of Stock'])
            },
            specs: {
                weight: `${this.randomInt(100, 2000)}g`,
                dimensions: `${this.randomInt(10, 50)}x${this.randomInt(10, 50)}x${this.randomInt(1, 10)} cm`,
                color: this.randomItem(['Black', 'White', 'Silver', 'Gold']),
                material: this.randomItem(['Plastic', 'Metal', 'Glass'])
            },
            categories: [this.randomItem(['Electronics', 'Home', 'Gadgets']), 'New Arrivals'],
            images: [
                `https://example.com/img/${this.randomId()}.jpg`,
                `https://example.com/img/${this.randomId()}.jpg`
            ],
            reviews: Array.from({ length: 3 }, () => ({
                user: isCN ? '匿名用户' : 'Anonymous',
                rating: this.randomInt(3, 5),
                comment: isCN ? '非常好用，推荐购买！' : 'Great product, highly recommended!',
                date: this.randomDate()
            }))
        };
    }

    genOrder(locale) {
        const isCN = locale === 'zh_CN';
        const items = Array.from({ length: this.randomInt(1, 4) }, () => ({
            itemId: this.randomId(),
            productName: isCN ? '示例商品' : 'Sample Product',
            quantity: this.randomInt(1, 5),
            unitPrice: this.randomInt(50, 500)
        }));
        const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

        return {
            orderId: `ORD-${new Date().getFullYear()}-${this.randomInt(100000, 999999)}`,
            customer: {
                id: this.randomInt(1000, 9999),
                name: isCN ? '李四' : 'Jane Doe'
            },
            status: this.randomItem(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
            timeline: [
                { status: 'created', time: this.randomDate() },
                { status: 'paid', time: this.randomDate() }
            ],
            items: items,
            billing: {
                subtotal: subtotal,
                tax: Math.floor(subtotal * 0.1),
                shippingFee: 15,
                total: Math.floor(subtotal * 1.1 + 15),
                currency: isCN ? 'CNY' : 'USD',
                paymentMethod: this.randomItem(['Credit Card', 'PayPal', 'Alipay', 'WeChat Pay'])
            },
            shippingAddress: this.genAddress(locale),
            notes: isCN ? '请尽快发货' : 'Please deliver on weekends'
        };
    }

    genAddress(locale) {
        const isCN = locale === 'zh_CN';
        return {
            street: isCN ? `${this.randomInt(1, 999)}号, 科技路` : `${this.randomInt(1, 9999)} Tech Avenue`,
            unit: `${this.randomInt(1, 20)}0${this.randomInt(1, 9)}`,
            city: isCN ? this.randomItem(['北京市', '上海市', '深圳市', '杭州市']) : this.randomItem(['San Francisco', 'London', 'Berlin', 'Tokyo']),
            state: isCN ? '直辖市' : 'CA',
            zipCode: `${this.randomInt(10000, 99999)}`,
            country: isCN ? '中国' : 'USA',
            coordinates: {
                lat: (Math.random() * 180 - 90).toFixed(6),
                lng: (Math.random() * 360 - 180).toFixed(6)
            },
            type: this.randomItem(['Home', 'Office', 'Billing'])
        };
    }

    genCompany(locale) {
        const isCN = locale === 'zh_CN';
        return {
            id: `COMP-${this.randomInt(1000, 9999)}`,
            name: isCN ? '未来科技股份有限公司' : 'Future Tech Inc.',
            description: isCN ? '专注于人工智能与大数据的创新企业' : 'Leading the way in AI and Big Data innovation.',
            industry: this.randomItem(['Technology', 'Finance', 'Healthcare', 'Retail']),
            founded: this.randomInt(1990, 2020),
            size: this.randomItem(['1-10', '11-50', '51-200', '201-500', '500+']),
            headquarters: this.genAddress(locale),
            departments: [
                { name: 'R&D', head: isCN ? '王总' : 'Mr. King', employeeCount: this.randomInt(10, 100) },
                { name: 'Marketing', head: isCN ? '张总' : 'Ms. Zhang', employeeCount: this.randomInt(5, 50) }
            ],
            contact: {
                email: 'contact@futuretech.com',
                phone: '+1-800-555-0199',
                website: 'https://www.futuretech.com',
                social: {
                    linkedin: 'linkedin.com/company/futuretech',
                    twitter: '@futuretech'
                }
            },
            financials: {
                revenue: `${this.randomInt(1, 100)}M`,
                growth: `${this.randomInt(5, 30)}%`,
                fiscalYear: '2023'
            }
        };
    }

    genArticle(locale) {
        const isCN = locale === 'zh_CN';
        return {
            id: this.randomInt(10000, 99999),
            title: isCN ? '2024年科技趋势展望' : 'Technology Trends Outlook for 2024',
            slug: 'technology-trends-2024',
            author: {
                id: this.randomInt(100, 999),
                name: isCN ? '科技观察家' : 'Tech Observer',
                bio: isCN ? '资深科技媒体人' : 'Senior Tech Journalist'
            },
            content: {
                summary: isCN ? '本文深入探讨了人工智能、区块链等技术在未来的发展...' : 'This article explores the future development of AI and Blockchain...',
                body: '<p>Lorem ipsum dolor sit amet...</p>',
                format: 'html'
            },
            tags: isCN ? ['科技', 'AI', '未来'] : ['Tech', 'AI', 'Future'],
            meta: {
                views: this.randomInt(1000, 50000),
                likes: this.randomInt(100, 5000),
                shares: this.randomInt(50, 1000),
                readingTime: `${this.randomInt(3, 15)} min`
            },
            status: 'published',
            publishDate: this.randomDate(),
            comments: [
                { user: 'user1', text: 'Great article!', date: this.randomDate() }
            ]
        };
    }

    genApi(locale) {
        return {
            meta: {
                requestId: this.randomId(),
                timestamp: new Date().toISOString(),
                version: 'v1.2.0',
                environment: 'production'
            },
            status: {
                code: 200,
                message: 'OK',
                success: true
            },
            pagination: {
                page: 1,
                pageSize: 20,
                totalItems: 145,
                totalPages: 8,
                hasNext: true,
                hasPrev: false
            },
            data: Array.from({ length: 2 }, () => this.genUser(locale)),
            links: {
                self: '/api/v1/users?page=1',
                next: '/api/v1/users?page=2',
                last: '/api/v1/users?page=8'
            }
        };
    }

    genConfig(locale) {
        return {
            appName: 'MyAwesomeApp',
            version: '2.5.0',
            environment: this.randomItem(['development', 'staging', 'production']),
            debugMode: this.randomBool(),
            server: {
                host: '0.0.0.0',
                port: 8080,
                timeout: 30000,
                cors: {
                    enabled: true,
                    origins: ['*']
                }
            },
            database: {
                type: 'postgres',
                host: 'db-cluster-01.internal',
                port: 5432,
                username: 'admin',
                poolSize: { min: 5, max: 20 }
            },
            redis: {
                host: 'redis-cache.internal',
                port: 6379,
                ttl: 3600
            },
            features: {
                newUI: true,
                betaFeatures: false,
                maintenanceMode: false
            },
            logging: {
                level: 'info',
                file: '/var/log/app.log',
                format: 'json'
            }
        };
    }

    useGeneratedData() {
        const val = document.getElementById('generatedJson').value;
        if (!val) return;
        document.getElementById('jsonEditor').value = val;
        this.app.layout.switchTab('formatter');
        this.app.formatter.formatJSON();
    }
}