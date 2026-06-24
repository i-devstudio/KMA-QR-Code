/**
 * KMA Social Hub - Frontend Logic
 * จัดการเก็บสถิติการคลิก ดึงลิงก์โซเชียลมีเดียล่าสุดจาก Google Sheets และ Redirect ไปยังปลายทาง
 */

// 1. ตั้งค่าลิงก์สำรอง (Fallback Links) ในกรณีที่ยังดึงข้อมูลจาก API ไม่เสร็จ หรือ API เกิดข้อผิดพลาด
// ช่วยให้ผู้ใช้ยังคงใช้งานเว็บบอร์ดได้ทันทีโดยไม่ติดขัด
const FALLBACK_LINKS = {
    LINE: "https://line.me/R/ti/p/@864hngdj?oat__id=4963057", 
    TikTok: "https://www.tiktok.com/@kmacosmetics", 
    Facebook: "https://www.facebook.com/kmacosmetics/?locale=th_TH", 
    Instagram: "https://www.instagram.com/kmacosmetics/" 
};

// 2. ลิงก์สำหรับใช้งานจริงในโปรแกรม (จะอัปเดตเป็นค่าจาก Google Sheets เมื่อดึงข้อมูลเสร็จ)
let activeSocialLinks = { ...FALLBACK_LINKS };

// 3. URL ของ Google App Script Web App API 
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbx9lnbHD8XCVe4pH5U6csiZxpSYdSrGvWRnG6LLhjvi0KUrviijNEWKBG5Ns4gsn5nl/exec"; 

document.addEventListener("DOMContentLoaded", () => {
    // โหลดลิงก์ล่าสุดจาก Google Sheets
    fetchLatestLinks();

    const socialButtons = document.querySelectorAll(".social-btn");

    socialButtons.forEach(button => {
        button.addEventListener("click", (event) => {
            event.preventDefault();

            const socialName = button.getAttribute("data-social");
            const redirectUrl = activeSocialLinks[socialName] || FALLBACK_LINKS[socialName];

            if (redirectUrl) {
                trackAndRedirect(socialName, redirectUrl);
            } else {
                console.error(`ไม่พบลิงก์ปลายทางสำหรับ: ${socialName}`);
            }
        });
    });
});

/**
 * ดึงข้อมูลลิงก์โซเชียลล่าสุดจาก Google Sheets ผ่าน API ของ GAS
 * (ทำงานแบบเบื้องหลัง Asynchronous เพื่อรักษาความเร็วในการแสดงผลหน้าแรกให้ < 1 วินาที)
 */
function fetchLatestLinks() {
    if (!GAS_API_URL) {
        console.log("ใช้งานลิงก์สำรอง (ยังไม่ได้ตั้งค่า API URL)");
        return;
    }

    const apiUrl = `${GAS_API_URL}?action=getLinks`;

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.links) {
                // บันทึกทับลิงก์ที่ใช้งานอยู่ด้วยข้อมูลล่าสุดจาก Google Sheets
                activeSocialLinks = { ...data.links };
                console.log("อัปเดตลิงก์โซเชียลล่าสุดจาก Google Sheet สำเร็จ:", activeSocialLinks);
            }
        })
        .catch(error => {
            console.error("ไม่สามารถเชื่อมต่อดึงลิงก์ล่าสุดได้ ระบบจะใช้ลิงก์สำรองแทน:", error);
        });
}

/**
 * ส่งสถิติคลิกไปยังหลังบ้านและเปลี่ยนทิศทางเพจ พร้อมข้อมูลวิเคราะห์เครื่องผู้ใช้
 */
function trackAndRedirect(social, url) {
    console.log(`กำลังบันทึกสถิติและเตรียมไปที่: ${social} -> ${url}`);

    if (!GAS_API_URL) {
        window.location.href = url;
        return;
    }

    let requestSent = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        if (!requestSent) {
            controller.abort();
            console.log("API ตอบสนองช้า ดำเนินการ Redirect ทันที");
            window.location.href = url;
        }
    }, 250); // ดีเลย์ไม่เกิน 250ms เพื่อประสบการณ์ที่รวดเร็ว

    // รวบรวมข้อมูลผู้ใช้งานเพื่อการตลาด
    const clickData = {
        action: "trackClick",
        social: social,
        device: getDeviceType(),
        browser: getBrowserType(),
        language: navigator.language || "",
        userAgent: navigator.userAgent || ""
    };

    fetch(GAS_API_URL, {
        method: "POST",
        mode: "cors",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(clickData),
        signal: controller.signal
    })
    .then(response => {
        requestSent = true;
        clearTimeout(timeoutId);
        return response.json();
    })
    .then(data => {
        console.log("บันทึกสถิติสำเร็จ:", data);
        window.location.href = url;
    })
    .catch(error => {
        requestSent = true;
        clearTimeout(timeoutId);
        console.warn("สถิติไม่ถูกส่ง/ล้มเหลว แต่เปลี่ยนหน้าจอไปยังเป้าหมาย:", error);
        window.location.href = url;
    });
}

// ─────────────────────────────────────────────
// Helpers: ตรวจสอบประเภทอุปกรณ์และเบราว์เซอร์ของผู้ใช้งาน
// ─────────────────────────────────────────────
function getDeviceType() {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return "iOS (iPhone/iPad)";
    if (/android/i.test(ua)) return "Android Device";
    if (/Macintosh/i.test(ua)) return "macOS (Mac)";
    if (/Windows/i.test(ua)) return "Windows PC";
    if (/Linux/i.test(ua)) return "Linux PC";
    return "Unknown Device";
}

function getBrowserType() {
    const ua = navigator.userAgent;
    
    // ตรวจสอบ WebView/Browser ในแอปโซเชียลมีเดียต่างๆ
    if (/Line/i.test(ua)) return "LINE App Browser";
    if (/FBAV|FBAN/i.test(ua)) return "Facebook App";
    if (/Instagram/i.test(ua)) return "Instagram App";
    if (/Twitter/i.test(ua)) return "Twitter App";
    if (/TikTok/i.test(ua)) return "TikTok App";
    
    // เบราว์เซอร์ปกติ
    if (/CriOS/i.test(ua) || (/Chrome/i.test(ua) && !/Edge|Edg/i.test(ua))) return "Chrome";
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua) && !/CriOS/i.test(ua)) return "Safari";
    if (/Firefox/i.test(ua)) return "Firefox";
    if (/Edge|Edg/i.test(ua)) return "Edge";
    
    return "Mobile WebView / Other";
}
