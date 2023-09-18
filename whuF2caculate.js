// ==UserScript==
// @name         武大综测F2年度计算小工具
// @namespace    whu
// @version      1.0
// @author       game-loader
// @description  计算武大综测F2部分
// @homepage     https://github.com/game-loader
// @match        https://jwgl.whu.edu.cn/cjcx/cjcx_cxDgXscj.html*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // 创建小窗口
    var container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '50%';
    container.style.right = '20%';
    container.style.transform = 'translate(50%, -50%)';
    container.style.backgroundColor = '#ffffff';
    container.style.padding = '20px';
    container.style.border = '1px solid #000000';
    container.style.zIndex = '1000';

    // 创建年份下拉框
    var yearSelect = document.createElement('select');
    yearSelect.innerHTML = `
        <option value="2021">2021</option>
        <option value="2022">2022</option>
        <option value="2023">2023</option>
        <option value="2024">2024</option>
    `;
    container.appendChild(yearSelect);

    // 添加距离
    var spacer = document.createElement('div');
    spacer.style.height = '10px';
    container.appendChild(spacer);

    // 创建计算按钮
    var calculateButton = document.createElement('button');
    calculateButton.textContent = '计算综测F2';
    calculateButton.style.backgroundColor = '#8ae68a';
    calculateButton.style.color = '#ffffff';
    calculateButton.style.border = 'none';
    calculateButton.style.borderRadius = '5px';
    calculateButton.style.padding = '8px 16px';
    calculateButton.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.4)';
    container.appendChild(calculateButton);

    // 将小窗口添加到页面中
    document.body.appendChild(container);

    // 设置小窗口样式
    container.style.width = '300px';
    container.style.height = '200px';
    container.style.overflow = 'auto';

    // 绑定按钮点击事件
    calculateButton.addEventListener('click', function() {
        // 获取gnmkdmKey的值
        var gnmkdmKey = document.getElementById('gnmkdmKey').value;

        // 构造请求URL和postData
        var url = 'https://jwgl.whu.edu.cn/cjcx/cjcx_cxXsgrcj.html';
        var params = 'doType=query&gnmkdm=' + encodeURIComponent(gnmkdmKey);
        var postData = 'xnm=' + yearSelect.value + '&xqm=&kcbj=&_search=false&nd=' + Date.now() + '&queryModel.showCount=15&queryModel.currentPage=1&queryModel.sortName=&queryModel.sortOrder=asc&time=0';

        // 最终请求URL
        var finalUrl = url + '?' + params;

        // 发送POST请求
        GM_xmlhttpRequest({
    method: 'POST',
    url: finalUrl,
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: postData,
    onload: function(response) {
        var responseData = JSON.parse(response.responseText);
        var items = responseData.items;

        // 创建变量用于存储必修成绩、选修成绩和必修学分
var requiredScore = 0;
var electiveScore = 0;
var requiredCredits = 0;

// 遍历数组中的各项
for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var kcxzmc = item.kcxzmc;
    var bfzcj = parseFloat(item.bfzcj);
    var xf = parseFloat(item.xf);

    if (kcxzmc.includes("必修")) {
        requiredScore += bfzcj * xf;
        requiredCredits += xf;
    } else if (kcxzmc.includes("选修")) {
        electiveScore += bfzcj * xf;
    }
}

// 在窗口中显示成绩
var requiredGrade = requiredScore / requiredCredits;
var electiveGrade = electiveScore * 0.002;
var totalGrade = requiredGrade + electiveGrade;

// 创建显示结果的元素
var resultElement = document.createElement('div');
resultElement.style.marginTop = '10px';

// 创建必修课成绩显示行
var requiredGradeElement = document.createElement('div');
requiredGradeElement.textContent = "必修课：" + requiredGrade.toFixed(2);
resultElement.appendChild(requiredGradeElement);

// 创建选修课成绩显示行
var electiveGradeElement = document.createElement('div');
electiveGradeElement.textContent = "选修课：" + electiveGrade.toFixed(2);
resultElement.appendChild(electiveGradeElement);

// 创建F2成绩显示行
var totalGradeElement = document.createElement('div');
totalGradeElement.textContent = "F2：" + totalGrade.toFixed(2);
resultElement.appendChild(totalGradeElement);

// 在按钮下方显示结果
container.appendChild(resultElement);
    }
});
    });
})();
