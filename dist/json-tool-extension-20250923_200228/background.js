// Chrome扩展后台脚本
chrome.runtime.onInstalled.addListener(() => {
    console.log('JSON工具扩展已安装');
});

// 监听扩展图标点击事件
chrome.action.onClicked.addListener((tab) => {
    // 打开新标签页显示JSON工具
    chrome.tabs.create({
        url: chrome.runtime.getURL('index.html')
    });
});