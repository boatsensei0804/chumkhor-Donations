/**
 * =========================================================================
 * ระบบแสดงผลยอดบริจาคผ้าป่าเพื่อการศึกษา โรงเรียนชำฆ้อพิทยาคม (Google Apps Script)
 * ครบรอบ ๓๒ ปี โรงเรียนชำฆ้อพิทยาคม จ.ระยอง
 * =========================================================================
 */

// =========================================================================
// ⚙️ การตั้งค่าการเชื่อมโยง Google Sheet
// =========================================================================
// 1. กรณีสร้าง Apps Script จากเมนู "ส่วนขยาย > Apps Script" ภายใน Google Sheet:
//    -> เว้นว่างไว้เป็น '' ได้เลย ระบบจะเชื่อมกับ Sheet นั้นให้อัตโนมัติ
//
// 2. กรณีสร้างโปรเจกต์เดี่ยวจาก script.google.com (Standalone Script):
//    -> นำ URL หรือ ID ของ Google Sheet มาใส่ในเครื่องหมายคำพูดด้านล่าง
//    -> ตัวอย่าง: 'https://docs.google.com/spreadsheets/d/1xxxxxxxxxxxx/edit'
//    -> หรือหากปล่อยว่างไว้ ระบบจะสร้างไฟล์ Google Sheet ให้คุณบน Google Drive อัตโนมัติทันที!
const SPREADSHEET_ID_OR_URL = 'https://docs.google.com/spreadsheets/d/1vbMz7XKdLT0pEw5YRnnPtQkklZAPpGaXBbwwF1uJrNY/edit';

const SHEET_NAMES = {
  DONATIONS: 'Donations',
  SETTINGS: 'Settings',
};

/**
 * ค้นหาและคืนค่า Spreadsheet Object อย่างปลอดภัย
 * ป้องกันข้อผิดพลาด TypeError: Cannot read properties of null (reading 'getSheetByName')
 */
function getSpreadsheet() {
  // 1. ลองดึงจาก Active Spreadsheet ก่อน (กรณีสร้างจากเมนู ส่วนขยาย > Apps Script)
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {
    Logger.log('Active spreadsheet not found: ' + e);
  }

  // 2. ลองดึงจากตัวแปร SPREADSHEET_ID_OR_URL ที่กำหนดไว้ด้านบน
  if (typeof SPREADSHEET_ID_OR_URL === 'string' && SPREADSHEET_ID_OR_URL.trim() !== '') {
    const ss = openSpreadsheetByIdOrUrl(SPREADSHEET_ID_OR_URL.trim());
    if (ss) {
      try {
        PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
      } catch (e) {}
      return ss;
    }
  }

  // 3. ลองดึงจาก Script Properties ที่เคยบันทึกไว้
  try {
    const savedId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (savedId) {
      const ss = SpreadsheetApp.openById(savedId);
      if (ss) return ss;
    }
  } catch (e) {
    Logger.log('Saved spreadsheet ID not found or inaccessible: ' + e);
  }

  // 4. กรณีเป็น Standalone Script และยังไม่มี Sheet: สร้างไฟล์ Google Sheet ใหม่ใน Drive ให้อัตโนมัติทันที
  try {
    const newSheet = SpreadsheetApp.create('ยอดบริจาคผ้าป่า - รร.ชำฆ้อพิทยาคม');
    const newId = newSheet.getId();
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', newId);
    Logger.log('✨ สร้าง Google Sheet ไฟล์ใหม่ให้อัตโนมัติสำเร็จ: ' + newSheet.getUrl());
    return newSheet;
  } catch (err) {
    throw new Error('ไม่สามารถเข้าถึงหรือสร้าง Google Sheet ได้ กรุณาระบุ SPREADSHEET_ID_OR_URL ใน Code.gs: ' + err.message);
  }
}

/**
 * ฟังก์ชันช่วยเปิด Spreadsheet จาก URL หรือ ID
 */
function openSpreadsheetByIdOrUrl(idOrUrl) {
  if (!idOrUrl || typeof idOrUrl !== 'string') return null;
  const trimmed = idOrUrl.trim();
  if (!trimmed) return null;

  try {
    // 1. ถ้าเป็น URL ดึง ID ออกมา
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return SpreadsheetApp.openById(match[1]);
    }

    // 2. ถ้าเป็น ID ตรงๆ
    if (trimmed.indexOf('http') !== 0 && trimmed.length >= 20) {
      return SpreadsheetApp.openById(trimmed);
    }

    // 3. ลองเปิดด้วย openByUrl
    if (trimmed.indexOf('http') === 0) {
      return SpreadsheetApp.openByUrl(trimmed);
    }
  } catch (err) {
    Logger.log('⚠️ ไม่สามารถเปิด Google Sheet ได้: ' + err.message);
  }
  return null;
}

/**
 * ฟังก์ชันกำหนด URL หรือ ID ของ Google Sheet
 */
function setSpreadsheet(idOrUrl) {
  const ss = openSpreadsheetByIdOrUrl(idOrUrl);
  if (!ss) {
    throw new Error('ไม่พบ Google Sheet ตาม URL หรือ ID ที่ระบุ กรุณาตรวจสอบสิทธิ์การเข้าถึง');
  }
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  initSheets();
  return { status: 'success', url: ss.getUrl(), id: ss.getId() };
}

/**
 * ฟังก์ชันเริ่มต้นสำหรับรองรับปุ่ม "เรียกใช้ (Run)" บน Apps Script
 * แก้ไขปัญหา: "ข้อผิดพลาด: พยายามใช้ myFunction แล้ว แต่ถูกลบออก"
 * เมื่อกด Run ฟังก์ชันนี้ จะสั่งสร้างแผ่นงานเริ่มต้น (initSheets) ให้อัตโนมัติทันที
 */
function myFunction() {
  return initSheets();
}

/**
 * ฟังก์ชันสำหรับแสดงหน้าเว็บ Web App
 */
function doGet(e) {
  const params = (e && e.parameter) || {};

  // ถ้าเรียก API ดึงข้อมูล JSON โดยตรง หรือสั่ง Action ผ่าน GET
  if (params.api === 'state' || params.action) {
    let result = {};
    const action = params.action;
    if (action === 'addDonation') {
      result = addDonation(params.donorName, params.amount, params.note, params.showPopup !== 'false');
    } else if (action === 'deleteDonation') {
      result = deleteDonation(params.id);
    } else if (action === 'updateTotal') {
      result = updateTotal(params.total);
    } else if (action === 'updateSettings') {
      try {
        result = updateSettings(JSON.parse(params.settings || '{}'));
      } catch (e) {
        result = getState();
      }
    } else if (action === 'triggerPopup') {
      try {
        result = triggerPopup(JSON.parse(params.popup || '{}'));
      } catch (e) {
        result = triggerPopup(params.popup);
      }
    } else if (action === 'resetData') {
      result = resetData(params.initialTotal, params.initialTitle);
    } else {
      result = getState();
    }
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  let webAppUrl = '';
  try {
    webAppUrl = ScriptApp.getService().getUrl() || '';
  } catch (err) {}

  // หน้าจอ Admin
  if (params.screen === 'admin') {
    const template = HtmlService.createTemplateFromFile('Admin');
    template.webAppUrl = webAppUrl;
    return template.evaluate()
      .setTitle('จัดการยอดบริจาค (Admin) - โรงเรียนชำฆ้อพิทยาคม')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // หน้าจอหลัก Display (สำหรับฉายโปรเจกเตอร์)
  const template = HtmlService.createTemplateFromFile('Display');
  template.webAppUrl = webAppUrl;
  return template.evaluate()
    .setTitle('ยอดบริจาคผ้าป่าเพื่อการศึกษา - โรงเรียนชำฆ้อพิทยาคม')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * ฟังก์ชันรับคำขอ POST (REST API)
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    let result = {};
    if (action === 'addDonation') {
      result = addDonation(body.donorName, body.amount, body.note, body.showPopup);
    } else if (action === 'deleteDonation') {
      result = deleteDonation(body.id);
    } else if (action === 'updateTotal') {
      result = updateTotal(body.total);
    } else if (action === 'updateSettings') {
      result = updateSettings(body.settings);
    } else if (action === 'triggerPopup') {
      result = triggerPopup(body.popup);
    } else if (action === 'resetData') {
      result = resetData(body.initialTotal, body.initialTitle);
    } else if (action === 'setSpreadsheet') {
      result = setSpreadsheet(body.sheetUrl || body.sheetId);
    } else {
      result = getState();
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * สร้างหรือตรวจสอบแผ่นงาน (Sheet) เริ่มต้นอัตโนมัติ
 */
function initSheets() {
  const ss = getSpreadsheet();
  if (!ss) {
    throw new Error('ไม่สามารถเข้าถึง Google Sheet ได้');
  }

  // 1. ตรวจสอบ Sheet Donations
  let donationSheet = ss.getSheetByName(SHEET_NAMES.DONATIONS);
  if (!donationSheet) {
    donationSheet = ss.insertSheet(SHEET_NAMES.DONATIONS);
    donationSheet.appendRow(['ID', 'Timestamp', 'ชื่อผู้บริจาค', 'จำนวนเงิน (บาท)', 'หมายเหตุ', 'แสดง Popup']);
    const headerRange = donationSheet.getRange(1, 1, 1, 6);
    headerRange.setBackground('#1E3A8A').setFontColor('#FFFFFF').setFontWeight('bold');

    // ตัวอย่างข้อมูลเริ่มต้น (รวม 67,500 บาท)
    const now = new Date();
    donationSheet.appendRow(['sample-1', new Date(now - 30 * 60000).toISOString(), 'คุณสมชาย ใจดี', 5000, 'กองบุญเพื่อทุนการศึกษา', 'TRUE']);
    donationSheet.appendRow(['sample-2', new Date(now - 65 * 60000).toISOString(), 'คุณวิภา และครอบครัวรัตนศิริ', 10000, 'ร่วมสมทบทุนจัดซื้ออุปกรณ์การเรียน', 'TRUE']);
    donationSheet.appendRow(['sample-3', new Date(now - 120 * 60000).toISOString(), 'ผู้ไม่ประสงค์ออกนาม', 2500, '', 'FALSE']);
    donationSheet.appendRow(['sample-4', new Date(now - 180 * 60000).toISOString(), 'คณะศิษย์เก่า รุ่นที่ ๑๒', 50000, 'ประธานสายผ้าป่า', 'TRUE']);
    donationSheet.setFrozenRows(1);
    donationSheet.autoResizeColumns(1, 6);
  }

  // 2. ตรวจสอบ Sheet Settings
  let settingsSheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet(SHEET_NAMES.SETTINGS);
    settingsSheet.appendRow(['Key', 'Value', 'คำอธิบาย']);
    const sHeader = settingsSheet.getRange(1, 1, 1, 3);
    sHeader.setBackground('#1E3A8A').setFontColor('#FFFFFF').setFontWeight('bold');

    const defaultSettings = [
      ['title', 'คณะผ้าป่าเพื่อการศึกษา', 'ชื่องานหลัก'],
      ['subtitle', '๓๒ ปี โรงเรียนชำฆ้อพิทยาคม จ.ระยอง', 'ชื่อรอง/สถาบัน'],
      ['soundEnabled', 'true', 'เปิด/ปิดเสียงกระดิ่ง (true/false)'],
      ['popupDurationSeconds', '5', 'ระยะเวลาแสดง Popup (วินาที)'],
      ['currencySymbol', '฿', 'สัญลักษณ์สกุลเงิน'],
      ['adminPin', '1234', 'รหัส PIN เข้าหน้า Admin'],
      ['countdownEnabled', 'true', 'เปิด/ปิดเวลานับถอยหลัง'],
      ['countdownTargetDate', '2026-10-03T12:00:00', 'วันเวลาเป้าหมายนับถอยหลัง'],
      ['countdownTitle', 'นับถอยหลังปิดรับยอด: วันเสาร์ที่ ๓ ตุลาคม เวลา ๑๒:๐๐ น.', 'ข้อความกำกับเวลานับถอยหลัง'],
      ['totalOverride', '', 'ยอดเงินแบบระบุเอง (ถ้าว่างจะคำนวณจากยอดบริจาคอัตโนมัติ)'],
      ['backgroundUrl', '', 'ลิงก์รูปภาพพื้นหลัง (ถ้าว่างจะใช้ค่าเริ่มต้น)'],
    ];

    defaultSettings.forEach(row => settingsSheet.appendRow(row));
    settingsSheet.setFrozenRows(1);
    settingsSheet.autoResizeColumns(1, 3);
  }

  Logger.log('✅ ระบบสร้างแผ่นงานเริ่มต้น (Donations และ Settings) เรียบร้อยแล้ว: ' + ss.getUrl());
  return { status: 'success', message: 'Initialized sheets successfully', url: ss.getUrl() };
}

/**
 * ดึงการตั้งค่าทั้งหมดจาก Sheet Settings
 */
function getSettingsMap() {
  initSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  const data = sheet.getDataRange().getValues();

  const map = {
    title: 'คณะผ้าป่าเพื่อการศึกษา',
    subtitle: '๓๒ ปี โรงเรียนชำฆ้อพิทยาคม จ.ระยอง',
    soundEnabled: true,
    popupDurationSeconds: 5,
    currencySymbol: '฿',
    adminPin: '1234',
    countdownEnabled: true,
    countdownTargetDate: '2026-10-03T12:00:00',
    countdownTitle: 'นับถอยหลังปิดรับยอด: วันเสาร์ที่ ๓ ตุลาคม เวลา ๑๒:๐๐ น.',
    totalOverride: null,
    backgroundUrl: '',
  };

  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][0]).trim();
    const val = String(data[i][1]).trim();
    if (!key) continue;

    if (key === 'soundEnabled' || key === 'countdownEnabled') {
      map[key] = val.toLowerCase() === 'true';
    } else if (key === 'popupDurationSeconds') {
      map[key] = parseInt(val) || 5;
    } else if (key === 'totalOverride') {
      map[key] = val !== '' ? parseFloat(val) : null;
    } else {
      map[key] = val;
    }
  }

  return map;
}

/**
 * เคลียร์แคชสถานะเพื่อให้คำขอถัดไปอ่านข้อมูลสดใหม่จาก Google Sheet ทันที
 */
function clearStateCache() {
  try {
    CacheService.getScriptCache().remove('CKP_STATE');
  } catch (e) {}
}

/**
 * บันทึกคำขอเด้ง Popup แจ้งเตือนฉุกเฉิน
 */
function triggerPopup(popup) {
  if (!popup) return getState();
  try {
    const cache = CacheService.getScriptCache();
    cache.put('PENDING_POPUP', typeof popup === 'string' ? popup : JSON.stringify(popup), 30);
  } catch (e) {}
  return getState();
}

/**
 * ดึงสถานะรวมของระบบ (ยอดเงิน, รายการบริจาค, การตั้งค่า)
 * มีระบบ Memory Cache 3 วินาที เพื่อตอบกลับข้อมูลอย่างรวดเร็วระดับเสี้ยววินาที (<200ms)
 */
function getState() {
  const cache = CacheService.getScriptCache();
  try {
    const cached = cache.get('CKP_STATE');
    if (cached) {
      const parsed = JSON.parse(cached);
      // ตรวจสอบว่ามี Popup ที่รอเด้งอยู่หรือไม่
      const pending = cache.get('PENDING_POPUP');
      if (pending) {
        parsed.pendingPopup = JSON.parse(pending);
        cache.remove('PENDING_POPUP');
      }
      return parsed;
    }
  } catch (e) {}

  initSheets();
  const ss = getSpreadsheet();
  const donationSheet = ss.getSheetByName(SHEET_NAMES.DONATIONS);
  const rows = donationSheet.getDataRange().getValues();

  const donations = [];
  let calculatedSum = 0;

  // อ่านรายการบริจาค (ข้ามแถวที่ 1 ซึ่งเป็น Header)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = String(row[0] || '').trim();
    if (!id) continue;

    const timestamp = String(row[1] || new Date().toISOString());
    const donorName = String(row[2] || 'ผู้มีจิตศรัทธา');
    const amount = parseFloat(row[3]) || 0;
    const note = String(row[4] || '');
    const showPopup = String(row[5]).toUpperCase() === 'TRUE';

    calculatedSum += amount;

    donations.push({
      id: id,
      timestamp: timestamp,
      donorName: donorName,
      amount: amount,
      note: note,
      showPopup: showPopup,
    });
  }

  // เรียงลำดับจากล่าสุดไปเก่าสุด
  donations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const settings = getSettingsMap();
  const total = settings.totalOverride !== null ? settings.totalOverride : calculatedSum;

  let sheetUrl = '';
  try {
    sheetUrl = ss.getUrl();
  } catch (e) {}

  let pendingPopup = null;
  try {
    const p = cache.get('PENDING_POPUP');
    if (p) {
      pendingPopup = JSON.parse(p);
      cache.remove('PENDING_POPUP');
    }
  } catch (e) {}

  const result = {
    total: total,
    donations: donations,
    settings: settings,
    pendingPopup: pendingPopup,
    timestamp: new Date().toISOString(),
    sheetUrl: sheetUrl,
  };

  try {
    // บันทึกลงแคช 3 วินาที เพื่อลดภาระการอ่าน Sheet ซ้ำซ้อน
    cache.put('CKP_STATE', JSON.stringify(result), 3);
  } catch (e) {}

  return result;
}

/**
 * เพิ่มรายการบริจาคใหม่
 */
function addDonation(donorName, amount, note, showPopup) {
  clearStateCache();
  initSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.DONATIONS);

  const id = 'don-' + Date.now();
  const timestamp = new Date().toISOString();
  const amt = parseFloat(amount) || 0;
  const popupBool = showPopup !== false ? 'TRUE' : 'FALSE';

  sheet.appendRow([id, timestamp, donorName.trim() || 'ผู้มีจิตศรัทธา', amt, (note || '').trim(), popupBool]);

  // หากมีการตั้งค่า totalOverride ไว้ ให้บวกเพิ่มตาม
  const settings = getSettingsMap();
  if (settings.totalOverride !== null) {
    updateSettingKey('totalOverride', (settings.totalOverride + amt).toString());
  }

  return getState();
}

/**
 * ลบรายการบริจาคตาม ID
 */
function deleteDonation(id) {
  clearStateCache();
  initSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.DONATIONS);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(id).trim()) {
      const amount = parseFloat(rows[i][3]) || 0;
      sheet.deleteRow(i + 1);

      const settings = getSettingsMap();
      if (settings.totalOverride !== null) {
        const next = Math.max(0, settings.totalOverride - amount);
        updateSettingKey('totalOverride', next.toString());
      }
      break;
    }
  }

  return getState();
}

/**
 * แก้ไขยอดรวมโดยตรง
 */
function updateTotal(newTotal) {
  clearStateCache();
  initSheets();
  updateSettingKey('totalOverride', String(newTotal));
  return getState();
}

/**
 * อัปเดตค่าใน Sheet Settings
 */
function updateSettingKey(key, value) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }

  // หากยังไม่มี key ให้เพิ่มแถวใหม่
  sheet.appendRow([key, value, '']);
}

/**
 * บันทึกการตั้งค่าหลายค่าพร้อมกัน
 */
function updateSettings(newSettings) {
  clearStateCache();
  initSheets();
  if (!newSettings) return getState();

  const keys = Object.keys(newSettings);
  keys.forEach(k => {
    updateSettingKey(k, String(newSettings[k]));
  });

  return getState();
}

/**
 * รีเซ็ตข้อมูลทั้งหมด
 */
function resetData(initialTotal, initialTitle) {
  clearStateCache();
  initSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.DONATIONS);

  // ลบข้อมูลทั้งหมดเหลือเฉพาะหัวตาราง
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }

  updateSettingKey('totalOverride', String(initialTotal || 0));
  if (initialTitle) {
    updateSettingKey('title', initialTitle);
  }

  return getState();
}

/**
 * คืนค่า URL ของ Google Sheet
 */
function getSpreadsheetUrl() {
  try {
    const ss = getSpreadsheet();
    return ss ? ss.getUrl() : '';
  } catch (e) {
    return '';
  }
}
