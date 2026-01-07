// ==UserScript==
// @name         武大全自动评教
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  全自动评教，一键评教
// @author       game-loader
// @license MIT
// @source       https://github.com/game-loader
// @match        *://ugsqs.whu.edu.cn/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_cookie
// @grant        GM_registerMenuCommand
// @downloadURL https://update.greasyfork.org/scripts/481742/%E6%AD%A6%E5%A4%A7%E5%85%A8%E8%87%AA%E5%8A%A8%E8%AF%84%E6%95%99.user.js
// @updateURL https://update.greasyfork.org/scripts/481742/%E6%AD%A6%E5%A4%A7%E5%85%A8%E8%87%AA%E5%8A%A8%E8%AF%84%E6%95%99.meta.js
// ==/UserScript==

(function () {
  "use strict";

  const BASE_URL = "https://ugsqs.whu.edu.cn";
  const FLOAT_BUTTON_ID = "autoEvaluateButtonFloat";
  const HEADER_BUTTON_ID = "autoEvaluateButtonHeader";
  const BUTTON_TEXT = "开始评教";

  // Function to retrieve and store necessary page values
  function retrievePageValues() {
    const hdfaidEl = document.getElementById("hdfaid");
    const kkxyEl = document.getElementById("kkxy");
    const roidEl = document.getElementById("roid");
    const zbtxEl = document.getElementById("zbtx");
    if (!hdfaidEl || !kkxyEl || !roidEl) {
      return;
    }

    let hdfaid = hdfaidEl.value;
    let kkxy = kkxyEl.value;
    let roid = roidEl.value;

    // Store these values for later use
    GM_setValue("hdfaid", hdfaid);
    GM_setValue("kkxy", kkxy);
    GM_setValue("roid", roid);
    if (zbtxEl) {
      GM_setValue("zbtx", zbtxEl.value);
    }
  }

  // Function to construct the POST request URL
  function constructPostRequestUrl() {
    let hdfaid = GM_getValue("hdfaid");
    let kkxy = GM_getValue("kkxy");
    let roid = GM_getValue("roid");
    if (!hdfaid || !kkxy || !roid) {
      return "";
    }

    return `${BASE_URL}/getStudentPjPf/${hdfaid}/${kkxy}/${roid}`;
  }

  // Add styles for the floating button
  GM_addStyle(`
        .auto-evaluate-float {
            position: fixed;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 10000;
            padding: 10px 20px;
            font-size: 16px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
        }
    `);

  function appendArray(formData, key, values) {
    values.forEach((value) => formData.append(key, value));
  }

  function getEvalContext() {
    return {
      hdfaid: GM_getValue("hdfaid"),
      kkxy: GM_getValue("kkxy"),
      roid: GM_getValue("roid"),
      zbtx: document.getElementById("zbtx")
        ? document.getElementById("zbtx").value
        : GM_getValue("zbtx"),
    };
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(
        `Request failed: ${response.status} ${response.statusText}`,
      );
    }
    return response.json();
  }

  async function fetchTxId(kclx) {
    const context = getEvalContext();
    const data = new URLSearchParams();
    data.append("kclx", kclx);
    if (context.zbtx) {
      data.append("zbtx", context.zbtx);
    }
    const result = await fetchJson(`${BASE_URL}/getTxId`, {
      method: "POST",
      body: data,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      credentials: "include",
    });
    return result && result.info && result.info[0] ? result.info[0].ID : "";
  }

  async function fetchIndicators(txid) {
    const data = new URLSearchParams();
    data.append("tiid", txid);
    const result = await fetchJson(`${BASE_URL}/tixizhibiaolist`, {
      method: "POST",
      body: data,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      credentials: "include",
    });
    return result && result.info && result.info.zbList
      ? result.info.zbList
      : [];
  }

  async function fetchTeacherList(item) {
    const context = getEvalContext();
    if (!context.hdfaid || !context.kkxy || !context.roid) {
      return [];
    }
    const url = `${BASE_URL}/getStudentPjPfJsghList/${context.hdfaid}/${context.kkxy}/${context.roid}/${item.KCH}`;
    const result = await fetchJson(url, {
      method: "POST",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
      credentials: "include",
    });
    return result && result.aaData ? result.aaData : [];
  }

  function splitIndicators(zbList) {
    const courseIndicators = [];
    const teacherIndicators = [];
    zbList.forEach((zb) => {
      if (zb.teacherlumindex === "课程指标") {
        courseIndicators.push(zb);
      } else {
        teacherIndicators.push(zb);
      }
    });
    return { courseIndicators, teacherIndicators };
  }

  function pickDowngradeIndex(questions) {
    const candidates = [];
    questions.forEach((zb, index) => {
      const scores = (zb.xxList || []).map((xx) => Number(xx.zbxxfz));
      const uniqueScores = Array.from(
        new Set(scores.filter((n) => Number.isFinite(n))),
      );
      if (uniqueScores.length > 1) {
        candidates.push(index);
      }
    });
    if (!candidates.length) {
      return -1;
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function buildAnswers(zbList, options) {
    const settings = options || {};
    const dxid = [];
    const dxvalue = [];
    const sfjft = [];
    const wdid = [];
    const wdvalue = [];
    let zf = 0;

    const singleChoices = zbList.filter((zb) => zb.zbtx === "单选题");
    const downgradeIndex = settings.avoidAllExcellent
      ? pickDowngradeIndex(singleChoices)
      : -1;

    singleChoices.forEach((zb, index) => {
      const optionsList = (zb.xxList || [])
        .slice()
        .sort((a, b) => Number(b.zbxxfz) - Number(a.zbxxfz));
      if (!optionsList.length) {
        return;
      }
      let choice = optionsList[0];
      if (index === downgradeIndex && optionsList.length > 1) {
        choice = optionsList[1];
      }
      dxid.push(zb.id);
      dxvalue.push(choice.zbxxfz);
      sfjft.push(zb.sfjft || 0);
      const weight = Number(zb.zbfzqz || 1);
      zf += Number(choice.zbxxfz) * (Number.isFinite(weight) ? weight : 1);
    });

    zbList.forEach((zb) => {
      if (zb.zbtx === "问答题") {
        wdid.push(zb.id);
        wdvalue.push(settings.openAnswer || "无");
      }
      if (zb.zbtx === "限制性问答题") {
        wdid.push(zb.id);
        wdvalue.push("0");
      }
    });

    return { dxid, dxvalue, sfjft, wdid, wdvalue, zf };
  }

  async function submitEvaluation(payload) {
    const data = new URLSearchParams();
    appendArray(data, "dxid", payload.dxid);
    appendArray(data, "dxvalue", payload.dxvalue);
    appendArray(data, "sfjft", payload.sfjft);
    appendArray(data, "wdid", payload.wdid);
    appendArray(data, "wdvalue", payload.wdvalue);

    data.append("rwid", GM_getValue("hdfaid"));
    data.append("xqid", payload.item.XQID);
    data.append("jsgh", payload.item.GH);
    data.append("kch", payload.item.KCH);
    data.append("bzxh", payload.item.BZXH);
    data.append("jxbdm", payload.item.JXBDM);
    data.append("xsxh", payload.item.XH);
    data.append("zf", Number(payload.zf).toFixed(2));
    data.append("pjjgid", payload.pjjgid || "");
    data.append("status", payload.status);
    data.append("txid", payload.txid);

    await fetchJson(`${BASE_URL}/createStudentPjpf`, {
      method: "POST",
      body: data,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      credentials: "include",
    });
  }

  async function evaluate(item) {
    if (item.CKZT !== null && item.CKZT !== undefined) {
      return;
    }

    const teachers = await fetchTeacherList(item);
    if (!teachers.length) {
      return;
    }

    const allDone = teachers.every((teacher) => teacher.STATUS === "1");
    if (allDone) {
      return;
    }

    const txid = await fetchTxId(item.KCLX);
    if (!txid) {
      console.warn("Missing txid for course:", item.KCH);
      return;
    }
    const indicators = await fetchIndicators(txid);
    if (!indicators.length) {
      console.warn("Missing indicators for txid:", txid);
      return;
    }

    const { courseIndicators, teacherIndicators } = splitIndicators(indicators);
    const courseAnswers = courseIndicators.length
      ? buildAnswers(courseIndicators, { avoidAllExcellent: true })
      : null;
    const teacherAnswers = teacherIndicators.length
      ? buildAnswers(teacherIndicators, {
          avoidAllExcellent: true,
          openAnswer: "无",
        })
      : null;

    const hasCoursePjjg = teachers.some((teacher) => !!teacher.PJJGID);
    if (!hasCoursePjjg && courseAnswers) {
      await submitEvaluation({
        ...courseAnswers,
        item: teachers[0],
        pjjgid: "",
        status: 0,
        txid,
      });
    }

    const updatedTeachers = await fetchTeacherList(item);
    for (const teacher of updatedTeachers) {
      if (teacher.STATUS === "1") {
        continue;
      }
      if (!teacher.PJJGID) {
        console.warn("Missing PJJGID for teacher:", teacher.GH, teacher.KCH);
        continue;
      }
      if (!teacherAnswers) {
        continue;
      }
      await submitEvaluation({
        ...teacherAnswers,
        item: teacher,
        pjjgid: teacher.PJJGID,
        status: 1,
        txid,
      });
    }
  }

  async function processData(responseData) {
    let data = responseData.aaData || [];
    const seen = new Set();
    for (const item of data) {
      if (!item || seen.has(item.KCH)) {
        continue;
      }
      seen.add(item.KCH);
      try {
        await evaluate(item);
      } catch (error) {
        console.error("Evaluation failed for course:", item.KCH, error);
      }
    }
  }

  // Function to navigate to the next page
  async function goToNextPage() {
    let currentPageIndex = parseInt(GM_getValue("currentPageIndex", 0));
    let nextPageStart = currentPageIndex * 10;
    let recordsPerPage = 10;

    const url = constructPostRequestUrl();
    if (!url) {
      console.warn("Missing evaluation context, cannot load page data.");
      return;
    }
    const data = {
      sEcho: 1,
      iColumns: 6,
      sColumns: "",
      iDisplayStart: nextPageStart,
      iDisplayLength: 10,
      mDataProp_0: "KCMC",
      mDataProp_1: "XM",
      mDataProp_2: "TJSJ",
      mDataProp_3: "YZ",
      mDataProp_4: "PJJGID",
      mDataProp_5: "",
      iSortCol_0: 0,
      sSortDir_0: "asc",
      iSortingCols: 1,
      bSortable_0: false,
      bSortable_1: false,
      bSortable_2: false,
      bSortable_3: false,
      bSortable_4: false,
      bSortable_5: false,
    };

    const formData = new URLSearchParams();
    for (const key in data) {
      formData.append(key, data[key]);
    }

    try {
      const responseData = await fetchJson(url, {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
      });
      await processData(responseData);
      let totalRecords = responseData.iTotalDisplayRecords || 0;
      hasMorePages = (currentPageIndex + 1) * recordsPerPage < totalRecords;

      if (hasMorePages) {
        GM_setValue("currentPageIndex", currentPageIndex + 1);
      }
    } catch (error) {
      console.error("Error fetching next page:", error);
    }
  }

  // Main function to manage the evaluation process
  async function mainEvaluationFunction() {
    while (hasMorePages) {
      await goToNextPage();
    }
    console.log("All pages have been processed.");
  }

  function startEvaluation() {
    retrievePageValues();
    if (!constructPostRequestUrl()) {
      console.warn(
        "Missing evaluation context, please open the evaluation page first.",
      );
      return;
    }
    hasMorePages = true;
    GM_setValue("currentPageIndex", 0);
    mainEvaluationFunction().catch((error) => {
      console.error("Evaluation flow failed:", error);
    });
  }

  function ensureStartButton() {
    const headerGroup = document.querySelector(
      "#titlelist .actions .btn-group",
    );
    if (headerGroup && !document.getElementById(HEADER_BUTTON_ID)) {
      const headerButton = document.createElement("a");
      headerButton.id = HEADER_BUTTON_ID;
      headerButton.href = "javascript:;";
      headerButton.textContent = BUTTON_TEXT;
      headerButton.className = "btn green mini";
      headerButton.addEventListener("click", startEvaluation);
      headerGroup.appendChild(headerButton);
    }

    if (headerGroup) {
      return;
    }

    if (document.getElementById(FLOAT_BUTTON_ID)) {
      return;
    }

    const target = document.body || document.documentElement;
    if (!target) {
      return;
    }
    const button = document.createElement("button");
    button.id = FLOAT_BUTTON_ID;
    button.className = "auto-evaluate-float";
    button.textContent = BUTTON_TEXT;
    button.addEventListener("click", startEvaluation);
    target.appendChild(button);
  }

  function installButtonWatcher() {
    const root = document.documentElement;
    if (!root) {
      return;
    }
    const observer = new MutationObserver(() => {
      ensureStartButton();
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  retrievePageValues();
  // List all cookies
  GM_cookie.list({}, function (cookies, error) {
    if (!error) {
      console.log("Cookies:", cookies);
    } else {
      console.error("Error listing cookies:", error);
    }
  });
  // Initialize or reset the current page index before starting the process
  GM_setValue("currentPageIndex", 0);
  // Create the start button
  var hasMorePages = true;
  ensureStartButton();
  installButtonWatcher();
  if (typeof GM_registerMenuCommand === "function") {
    GM_registerMenuCommand(BUTTON_TEXT, startEvaluation);
  }
})();
