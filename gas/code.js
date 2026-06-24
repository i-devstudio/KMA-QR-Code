/**
 * KMA Social Hub - Google App Script Backend API
 * สำหรับบันทึกข้อมูลการคลิก ดึงสถิติ และจัดการตั้งค่า Social Links ผ่าน Google Sheets
 */

// ชื่อ Sheet สำหรับบันทึกสถิติและลิงก์
var CLICKS_SHEET_NAME = "Clicks";
var LINKS_SHEET_NAME = "Links";

// รหัสผ่านสำรองเริ่มต้น (หากไม่มีการตั้งใน Script Properties)
var DEFAULT_ADMIN_PASSWORD = "kma_admin_password";

/**
 * ฟังก์ชันสร้างและตั้งค่า Sheet บันทึกการคลิก (หากไม่มี)
 */
function getOrCreateClicksSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CLICKS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CLICKS_SHEET_NAME);
    sheet.appendRow(["Timestamp", "Social"]);
    sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#C98B6F").setFontColor("#FFFFFF");
    sheet.setColumnWidth(1, 200);
    sheet.setColumnWidth(2, 150);
  }
  return sheet;
}

/**
 * ฟังก์ชันสร้างและตั้งค่า Sheet สำหรับเก็บลิงก์โซเชียล (หากไม่มี)
 */
function getOrCreateLinksSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LINKS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LINKS_SHEET_NAME);
    sheet.appendRow(["Social", "Url"]);
    sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#C98B6F").setFontColor("#FFFFFF");
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 450);
    
    // ใส่ลิงก์เริ่มต้น
    sheet.appendRow(["LINE", "https://line.me/R/ti/p/@kma_cosmetics"]);
    sheet.appendRow(["TikTok", "https://www.tiktok.com/@kma.cosmetics"]);
    sheet.appendRow(["Facebook", "https://www.facebook.com/kmacosmetics"]);
    sheet.appendRow(["Instagram", "https://www.instagram.com/kma_cosmetics_thailand"]);
  }
  return sheet;
}

/**
 * ดึงลิงก์โซเชียลทั้งหมดในสเปรดชีตออกมาเป็น Object JSON
 */
function getSocialLinks() {
  var sheet = getOrCreateLinksSheet();
  var data = sheet.getDataRange().getValues();
  var links = {};
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[0] && row[1]) {
      links[row[0].toString().trim()] = row[1].toString().trim();
    }
  }
  return links;
}

/**
 * 1. รับคำร้องขอแบบ GET (ดึงสถิติ หรือ ดึงข้อมูลลิงก์)
 */
function doGet(e) {
  var origin = "*";
  var action = e.parameter.action || "getLinks"; // ค่าเริ่มต้นคือดึงลิงก์ (สาธารณะ)
  
  try {
    // กรณีที่ 1: ดึงลิงก์โซเชียลมีเดีย (ไม่ต้องใช้รหัสผ่าน - เข้าถึงได้ทุกคน)
    if (action === "getLinks") {
      var links = getSocialLinks();
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        links: links
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", origin);
    }
    
    // กรณีที่ 2: ดึงประวัติการคลิกทั้งหมดของแอดมิน (ต้องตรวจสอบรหัสผ่าน)
    if (action === "getData") {
      var password = e.parameter.password;
      
      // ดึงรหัสผ่านแอดมินจริง
      var scriptProperties = PropertiesService.getScriptProperties();
      var adminPassword = scriptProperties.getProperty("ADMIN_PASSWORD");
      if (!adminPassword) {
        adminPassword = DEFAULT_ADMIN_PASSWORD;
        scriptProperties.setProperty("ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD);
      }
      
      if (!password || password !== adminPassword) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "Unauthorized"
        }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader("Access-Control-Allow-Origin", origin);
      }
      
      // อ่านข้อมูลประวัติสถิติคลิก
      var clicksSheet = getOrCreateClicksSheet();
      var clicksData = clicksSheet.getDataRange().getValues();
      var clicks = [];
      
      for (var i = 1; i < clicksData.length; i++) {
        var row = clicksData[i];
        var rawDate = row[0];
        var formattedDate = "";
        if (rawDate instanceof Date) {
          formattedDate = Utilities.formatDate(rawDate, "GMT+7", "yyyy-MM-dd HH:mm:ss");
        } else {
          formattedDate = rawDate.toString();
        }
        
        clicks.push({
          timestamp: formattedDate,
          social: row[1]
        });
      }
      
      // ดึงข้อมูลลิงก์ไปด้วยเพื่อแสดงบนแผงควบคุมหน้าแก้ไข
      var links = getSocialLinks();
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: clicks,
        links: links
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", origin);
    }
    
    // กรณีระบุ action ผิด
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "Invalid action parameter"
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", origin);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", origin);
  }
}

/**
 * 2. รับคำร้องขอแบบ POST (บันทึกคลิก หรือ บันทึกการแก้ไขลิงก์)
 */
function doPost(e) {
  var origin = "*";
  
  try {
    var payload;
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      payload = e.parameter;
    }
    
    var action = payload.action || "trackClick"; // ค่าเริ่มต้นคือเก็บบันทึกคลิก
    
    // กรณีที่ 1: บันทึกข้อมูลลิงก์ใหม่จากแผงแอดมิน
    if (action === "saveLinks") {
      var password = payload.password;
      var newLinks = payload.links; // ส่งมาในรูปแบบ { "LINE": "http...", "TikTok": "..." }
      
      var scriptProperties = PropertiesService.getScriptProperties();
      var adminPassword = scriptProperties.getProperty("ADMIN_PASSWORD");
      if (!adminPassword) {
        adminPassword = DEFAULT_ADMIN_PASSWORD;
        scriptProperties.setProperty("ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD);
      }
      
      if (!password || password !== adminPassword) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "Unauthorized"
        }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader("Access-Control-Allow-Origin", origin);
      }
      
      if (!newLinks) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "Missing 'links' payload data"
        }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader("Access-Control-Allow-Origin", origin);
      }
      
      // บันทึกทับข้อมูลใน Sheet "Links"
      var sheet = getOrCreateLinksSheet();
      sheet.clearContents(); // เคลียร์ตารางเดิมทั้งหมด
      sheet.appendRow(["Social", "Url"]); // ใส่ Header ใหม่
      
      // เขียนลิงก์ใหม่
      for (var socialKey in newLinks) {
        if (newLinks.hasOwnProperty(socialKey)) {
          sheet.appendRow([socialKey, newLinks[socialKey]]);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Links updated successfully"
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", origin);
    }
    
    // กรณีที่ 2: บันทึกประวัติคลิกสถิติ (trackClick)
    var social = payload.social;
    if (!social) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Missing 'social' value in request body"
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", origin);
    }
    
    var clicksSheet = getOrCreateClicksSheet();
    var timestamp = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
    
    clicksSheet.appendRow([timestamp, social]);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      timestamp: timestamp,
      social: social
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", origin);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", origin);
  }
}

/**
 * 3. OPTIONS Preflight Check
 */
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}
