// Chrome扩展后台脚本
chrome.runtime.onInstalled.addListener(() => {
    console.log('JSON工具扩展已安装');
});

// 监听扩展图标点击事件：已打开工具页则聚焦，否则新开标签页
chrome.action.onClicked.addListener(async () => {
    const url = chrome.runtime.getURL('index.html');
    const tabs = await chrome.tabs.query({ url });
    if (tabs.length > 0) {
        await chrome.tabs.update(tabs[0].id, { active: true });
        await chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
        await chrome.tabs.create({ url });
    }
});
