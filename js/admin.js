/**
 * KMA Social Hub - Admin Dashboard Logic
 * จัดการระบบ Login, ดึงข้อมูลจาก GAS API, กรองข้อมูล, คำนวณสถิติ และวาดกราฟ Daily Trend
 */

// 1. URL ของ Google App Script Web App API 
// (ต้องเป็น URL เดียวกับใน js/app.js)
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbx9lnbHD8XCVe4pH5U6csiZxpSYdSrGvWRnG6LLhjvi0KUrviijNEWKBG5Ns4gsn5nl/exec"; 

// คลาสจัดการข้อมูลสถิติ
class AdminDashboard {
    constructor() {
        this.rawClicks = []; // ข้อมูลดิบทั้งหมดจาก API
        this.filteredClicks = []; // ข้อมูลที่ผ่านการกรองแล้ว
        this.currentRange = "today"; // ตัวกรองปัจจุบัน
        this.chartInstance = null; // ออบเจ็กต์ Chart.js
        this.currentPage = 1;
        this.itemsPerPage = 10;
        
        // ผูกองค์ประกอบใน HTML
        this.initElements();
        // ผูก Events
        this.bindEvents();
        // ตรวจสอบเซสชันการล็อกอินเดิม
        this.checkSession();
    }

    initElements() {
        // Section & Forms
        this.loginSection = document.getElementById("login-section");
        this.dashboardSection = document.getElementById("dashboard-section");
        this.loginForm = document.getElementById("login-form");
        this.passwordInput = document.getElementById("password-input");
        this.loginErrorMsg = document.getElementById("login-error-msg");
        this.loginSpinner = document.getElementById("login-spinner");
        this.loginSubmitBtn = document.getElementById("login-submit-btn");
        this.logoutBtn = document.getElementById("logout-btn");
        this.apiStatus = document.getElementById("api-status");
        
        // Filters
        this.filterButtons = document.querySelectorAll(".filter-btn");
        this.currentFilterText = document.getElementById("current-filter-text");
        this.customDatePicker = document.getElementById("custom-date-picker");
        this.startDateInput = document.getElementById("start-date");
        this.endDateInput = document.getElementById("end-date");
        this.applyCustomFilterBtn = document.getElementById("apply-custom-filter");
        
        // KPI Elements
        this.kpiTotal = document.getElementById("kpi-total");
        this.kpiLine = document.getElementById("kpi-line");
        this.kpiTiktok = document.getElementById("kpi-tiktok");
        this.kpiFacebook = document.getElementById("kpi-facebook");
        this.kpiInstagram = document.getElementById("kpi-instagram");
        
        this.pctLine = document.getElementById("pct-line");
        this.pctTiktok = document.getElementById("pct-tiktok");
        this.pctFacebook = document.getElementById("pct-facebook");
        this.pctInstagram = document.getElementById("pct-instagram");

        // Progress bars
        this.valLine = document.getElementById("val-line");
        this.valTiktok = document.getElementById("val-tiktok");
        this.valFacebook = document.getElementById("val-facebook");
        this.valInstagram = document.getElementById("val-instagram");
        
        this.valPctLine = document.getElementById("val-pct-line");
        this.valPctTiktok = document.getElementById("val-pct-tiktok");
        this.valPctFacebook = document.getElementById("val-pct-facebook");
        this.valPctInstagram = document.getElementById("val-pct-instagram");

        this.barLine = document.getElementById("bar-line");
        this.barTiktok = document.getElementById("bar-tiktok");
        this.barFacebook = document.getElementById("bar-facebook");
        this.barInstagram = document.getElementById("bar-instagram");
        
        // Logs Table & Pagination
        this.logsTableBody = document.getElementById("logs-table-body");
        this.refreshDataBtn = document.getElementById("refresh-data-btn");
        this.paginationText = document.getElementById("pagination-text");
        this.prevPageBtn = document.getElementById("prev-page");
        this.nextPageBtn = document.getElementById("next-page");
        this.itemsPerPageSelect = document.getElementById("items-per-page");

        // Social Links Settings inputs & status
        this.settingsForm = document.getElementById("settings-form");
        this.linkLine = document.getElementById("link-line");
        this.linkTiktok = document.getElementById("link-tiktok");
        this.linkFacebook = document.getElementById("link-facebook");
        this.linkInstagram = document.getElementById("link-instagram");
        this.saveSettingsBtn = document.getElementById("save-settings-btn");
        this.settingsSpinner = document.getElementById("settings-spinner");
        this.settingsStatusMsg = document.getElementById("settings-status-msg");
    }

    bindEvents() {
        // Login Form
        this.loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            this.handleLogin(this.passwordInput.value);
        });

        // Logout
        this.logoutBtn.addEventListener("click", () => this.handleLogout());

        // Quick Filters
        this.filterButtons.forEach(btn => {
            btn.addEventListener("click", (e) => {
                const range = btn.getAttribute("data-range");
                this.setFilterRange(range, btn);
            });
        });

        // Custom Date Filter Apply
        this.applyCustomFilterBtn.addEventListener("click", () => {
            this.applyCustomDateFilter();
        });

        // Refresh Data
        this.refreshDataBtn.addEventListener("click", () => {
            this.fetchData(this.getPassword());
        });

        // Pagination Buttons
        this.prevPageBtn.addEventListener("click", () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderLogsTable();
            }
        });
        this.nextPageBtn.addEventListener("click", () => {
            const maxPage = Math.ceil(this.filteredClicks.length / this.itemsPerPage);
            if (this.currentPage < maxPage) {
                this.currentPage++;
                this.renderLogsTable();
            }
        });

        // Pagination Items Per Page Selector Change
        if (this.itemsPerPageSelect) {
            this.itemsPerPageSelect.addEventListener("change", (e) => {
                this.itemsPerPage = parseInt(e.target.value, 10);
                this.currentPage = 1;
                this.renderLogsTable();
            });
        }

        // Settings Form Submit
        if (this.settingsForm) {
            this.settingsForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.handleSaveLinks();
            });
        }
    }

    // จัดการเซสชันล็อกอิน
    checkSession() {
        const savedPassword = this.getPassword();
        if (savedPassword) {
            // ข้ามล็อกอินและดึงข้อมูลทันที
            this.showDashboard();
            this.fetchData(savedPassword);
        }
    }

    getPassword() {
        return sessionStorage.getItem("kma_admin_password");
    }

    setPassword(password) {
        sessionStorage.setItem("kma_admin_password", password);
    }

    clearPassword() {
        sessionStorage.removeItem("kma_admin_password");
    }

    showDashboard() {
        this.loginSection.classList.add("hidden");
        this.dashboardSection.classList.remove("hidden");
    }

    showLogin() {
        this.loginSection.classList.remove("hidden");
        this.dashboardSection.classList.add("hidden");
        this.passwordInput.value = "";
    }

    handleLogin(password) {
        this.setLoginLoading(true);
        this.loginErrorMsg.style.display = "none";

        // ตรวจสอบเงื่อนไขการใช้โหมดสาธิตแบบออฟไลน์/การตั้งค่า API ว่าง
        if (!GAS_API_URL) {
            setTimeout(() => {
                if (password === "kma1234" || password === "admin" || password === "kma_admin_password") {
                    this.setPassword(password);
                    this.showDashboard();
                    this.setLoginLoading(false);
                    this.loadMockData();
                } else {
                    this.setLoginLoading(false);
                    this.loginErrorMsg.style.display = "block";
                    this.loginErrorMsg.textContent = "รหัสผ่านไม่ถูกต้อง (ลองใช้: kma1234)";
                }
            }, 800);
        } else {
            // ดึงข้อมูลจริงจาก GAS
            this.fetchDataReal(password, (success, error) => {
                this.setLoginLoading(false);
                if (success) {
                    this.setPassword(password);
                    this.showDashboard();
                } else {
                    // หากเกิดข้อผิดพลาดในการเชื่อมต่อเน็ตเวิร์ก/CORS/หน้าเว็บอื่น (ที่ไม่ใช่รหัสผ่านผิดตัวตรงๆ Unauthorized)
                    // และผู้ใช้งานใส่รหัสผ่านที่ถูกต้องสำหรับระบบหรือโหมดเดโม เช่น kma1234
                    // ให้ความสะดวกในการข้ามเข้าไปดูหน้าแดชบอร์ดจำลองเพื่อทดลองใช้งาน
                    if (error !== "Unauthorized" && (password === "kma1234" || password === "admin" || password === "kma_admin_password")) {
                        console.warn("API Connection failed, falling back to Demo Mode:", error);
                        this.setPassword(password);
                        this.showDashboard();
                        this.loadMockData();
                        
                        // แสดงสถานะเตือนสีแดงในหน้าแดชบอร์ด
                        if (this.apiStatus) {
                            this.apiStatus.innerHTML = `<span class="status-dot red"></span> เชื่อมต่อล้มเหลว (ใช้ข้อมูลจำลอง)`;
                        }
                        
                        alert(`เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheets API: ${error}\n\nระบบเข้าสู่โหมดจำลอง (Demo Mode) ให้คุณเข้าใช้งานเพื่อความปลอดภัยชั่วคราวแล้วครับ`);
                    } else {
                        this.loginErrorMsg.style.display = "block";
                        this.loginErrorMsg.textContent = error === "Unauthorized" 
                            ? "รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง!" 
                            : `เกิดข้อผิดพลาดในการดึงข้อมูล: ${error}`;
                    }
                }
            });
        }
    }

    handleLogout() {
        this.clearPassword();
        this.showLogin();
        // เคลียร์ข้อมูลเดิม
        this.rawClicks = [];
        this.filteredClicks = [];
        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }
    }

    setLoginLoading(isLoading) {
        if (isLoading) {
            this.loginSpinner.classList.remove("hidden");
            this.loginSubmitBtn.disabled = true;
            this.loginSubmitBtn.querySelector("span").textContent = "กำลังตรวจสอบ...";
        } else {
            this.loginSpinner.classList.add("hidden");
            this.loginSubmitBtn.disabled = false;
            this.loginSubmitBtn.querySelector("span").textContent = "เข้าสู่ระบบ";
        }
    }

    // ดึงข้อมูลจาก API
    fetchData(password) {
        if (!GAS_API_URL) {
            this.loadMockData();
            return;
        }

        this.apiStatus.innerHTML = `<span class="status-dot orange"></span> กำลังดึงข้อมูล...`;
        this.fetchDataReal(password, (success, error) => {
            if (success) {
                this.apiStatus.innerHTML = `<span class="status-dot green"></span> เชื่อมต่อ API แล้ว`;
            } else {
                this.apiStatus.innerHTML = `<span class="status-dot orange"></span> เกิดข้อผิดพลาด`;
                alert(`ไม่สามารถดึงข้อมูลล่าสุดได้: ${error}`);
                if (error === "Unauthorized") {
                    this.handleLogout();
                }
            }
        });
    }

    fetchDataReal(password, callback) {
        const url = `${GAS_API_URL}?action=getData&password=${encodeURIComponent(password)}`;
        
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // บันทึกข้อมูลดิบ (เรียงจากใหม่ไปเก่าสำหรับตาราง ปลอดภัยสำหรับ Safari)
                    this.rawClicks = data.data.sort((a, b) => new Date(b.timestamp.replace(/-/g, "/")) - new Date(a.timestamp.replace(/-/g, "/")));
                    // อัปเดตข้อมูลลิงก์ในฟอร์ม
                    if (data.links) {
                        this.populateSettingsForm(data.links);
                    }
                    // อัปเดตข้อมูลตามฟิลเตอร์ปัจจุบัน
                    this.processData();
                    callback(true, null);
                } else {
                    callback(false, data.error || "Unknown error");
                }
            })
            .catch(error => {
                callback(false, error.message || error);
            });
    }

    // ฟังก์ชันสร้าง Mock Data สำหรับเดโม/พัฒนา
    loadMockData() {
        this.apiStatus.innerHTML = `<span class="status-dot green"></span> 📳 กำลังใช้ข้อมูลจำลอง (Demo Mode)`;
        
        // สร้างข้อมูลสุ่มย้อนหลัง 30 วัน
        const channels = ["LINE", "TikTok", "Facebook", "Instagram"];
        const demoData = [];
        const now = new Date();
        
        // สุ่มน้ำหนักสำหรับสร้างข้อมูลที่ดูสมจริง (LINE ฮิตสุด 40%, TikTok 30%, Facebook 20%, Instagram 10%)
        const getRandomChannel = () => {
            const r = Math.random();
            if (r < 0.40) return "LINE";
            if (r < 0.70) return "TikTok";
            if (r < 0.90) return "Facebook";
            return "Instagram";
        };

        // สุ่มข้อมูลประมาณ 150-250 รายการกระจายย้อนหลัง 30 วัน
        const clickCount = 180 + Math.floor(Math.random() * 80);
        for (let i = 0; i < clickCount; i++) {
            // สุ่มวันย้อนหลัง 0 - 30 วัน
            const daysAgo = Math.floor(Math.random() * 31);
            // สุ่มชั่วโมง-นาที-วินาที
            const hours = Math.floor(Math.random() * 24);
            const minutes = Math.floor(Math.random() * 60);
            const seconds = Math.floor(Math.random() * 60);
            
            const clickDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
            clickDate.setHours(hours, minutes, seconds);
            
            // Format วันที่ให้ตรงกับของ GAS: yyyy-MM-dd HH:mm:ss
            const yyyy = clickDate.getFullYear();
            const MM = String(clickDate.getMonth() + 1).padStart(2, '0');
            const dd = String(clickDate.getDate()).padStart(2, '0');
            const hh = String(clickDate.getHours()).padStart(2, '0');
            const mm = String(clickDate.getMinutes()).padStart(2, '0');
            const ss = String(clickDate.getSeconds()).padStart(2, '0');
            
            demoData.push({
                timestamp: `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`,
                social: getRandomChannel()
            });
        }

        // เรียงจากใหม่ไปเก่า
        this.rawClicks = demoData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        this.processData();
        
        // กรอก Mock Links ในฟอร์มแอดมินสำหรับเดโม
        const demoLinks = {
            LINE: "https://line.me/R/ti/p/@kma_cosmetics",
            TikTok: "https://www.tiktok.com/@kma.cosmetics",
            Facebook: "https://www.facebook.com/kmacosmetics",
            Instagram: "https://www.instagram.com/kma_cosmetics_thailand"
        };
        this.populateSettingsForm(demoLinks);
    }

    // กำหนดฟิลเตอร์ปุ่ม
    setFilterRange(range, activeBtn) {
        this.currentRange = range;
        
        // อัปเดต Active Class ของปุ่ม
        this.filterButtons.forEach(btn => btn.classList.remove("active"));
        activeBtn.classList.add("active");

        if (range === "custom") {
            this.customDatePicker.classList.remove("hidden");
            // กำหนดค่าตั้งต้นเป็นวันปัจจุบัน
            const todayStr = new Date().toISOString().split('T')[0];
            this.startDateInput.value = todayStr;
            this.endDateInput.value = todayStr;
        } else {
            this.customDatePicker.classList.add("hidden");
            this.processData();
        }
    }

    // กรองและคำนวณข้อมูลสถิติ
    processData() {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (this.currentRange === "today") {
            this.currentFilterText.textContent = "ช่วงเวลา: วันนี้";
            this.filteredClicks = this.rawClicks.filter(item => {
                const itemDate = new Date(item.timestamp.replace(/-/g, "/"));
                return itemDate >= startOfToday;
            });
        } else if (this.currentRange === "7days") {
            this.currentFilterText.textContent = "ช่วงเวลา: 7 วันล่าสุด";
            const sevenDaysAgo = new Date(startOfToday.getTime() - (7 * 24 * 60 * 60 * 1000));
            this.filteredClicks = this.rawClicks.filter(item => {
                const itemDate = new Date(item.timestamp.replace(/-/g, "/"));
                return itemDate >= sevenDaysAgo;
            });
        } else if (this.currentRange === "30days") {
            this.currentFilterText.textContent = "ช่วงเวลา: 30 วันล่าสุด";
            const thirtyDaysAgo = new Date(startOfToday.getTime() - (30 * 24 * 60 * 60 * 1000));
            this.filteredClicks = this.rawClicks.filter(item => {
                const itemDate = new Date(item.timestamp.replace(/-/g, "/"));
                return itemDate >= thirtyDaysAgo;
            });
        }

        this.currentPage = 1;
        this.updateDashboardUI();
    }

    // ดำเนินการฟิลเตอร์เมื่อกำหนดวันเอง
    applyCustomDateFilter() {
        const startStr = this.startDateInput.value;
        const endStr = this.endDateInput.value;

        if (!startStr || !endStr) {
            alert("กรุณากรอกวันที่ให้ครบถ้วน");
            return;
        }

        const startDate = new Date(startStr);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(endStr);
        endDate.setHours(23, 59, 59, 999);

        if (startDate > endDate) {
            alert("วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด");
            return;
        }

        // จัดรูปแบบหัวข้อแสดงฟิลเตอร์
        const formatDateThai = (dateStr) => {
            const parts = dateStr.split('-');
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        };
        this.currentFilterText.textContent = `ช่วงเวลา: ${formatDateThai(startStr)} ถึง ${formatDateThai(endStr)}`;

        // กรองข้อมูล
        this.filteredClicks = this.rawClicks.filter(item => {
            const itemDate = new Date(item.timestamp.replace(/-/g, "/"));
            return itemDate >= startDate && itemDate <= endDate;
        });

        this.currentPage = 1;
        this.updateDashboardUI();
    }

    // อัปเดตข้อมูลบนหน้าจอ Dashboard
    updateDashboardUI() {
        const total = this.filteredClicks.length;
        
        // นับจำนวนคลิกแยกค่าย
        const counts = { LINE: 0, TikTok: 0, Facebook: 0, Instagram: 0 };
        this.filteredClicks.forEach(item => {
            if (counts[item.social] !== undefined) {
                counts[item.social]++;
            }
        });

        // คำนวณเปอร์เซ็นต์
        const getPct = (val) => {
            if (total === 0) return 0;
            return Math.round((val / total) * 100);
        };

        const pct = {
            LINE: getPct(counts.LINE),
            TikTok: getPct(counts.TikTok),
            Facebook: getPct(counts.Facebook),
            Instagram: getPct(counts.Instagram)
        };

        // 1. อัปเดตตัวเลข KPI Cards
        this.kpiTotal.textContent = total.toLocaleString();
        
        this.kpiLine.textContent = counts.LINE.toLocaleString();
        this.pctLine.textContent = `${pct.LINE}% ของทั้งหมด`;
        
        this.kpiTiktok.textContent = counts.TikTok.toLocaleString();
        this.pctTiktok.textContent = `${pct.TikTok}% ของทั้งหมด`;
        
        this.kpiFacebook.textContent = counts.Facebook.toLocaleString();
        this.pctFacebook.textContent = `${pct.Facebook}% ของทั้งหมด`;
        
        this.kpiInstagram.textContent = counts.Instagram.toLocaleString();
        this.pctInstagram.textContent = `${pct.Instagram}% ของทั้งหมด`;

        // 2. อัปเดตในสัดส่วนความนิยม (Distribution List)
        this.valLine.textContent = counts.LINE.toLocaleString();
        this.valPctLine.textContent = `${pct.LINE}%`;
        this.barLine.style.width = `${pct.LINE}%`;

        this.valTiktok.textContent = counts.TikTok.toLocaleString();
        this.valPctTiktok.textContent = `${pct.TikTok}%`;
        this.barTiktok.style.width = `${pct.TikTok}%`;

        this.valFacebook.textContent = counts.Facebook.toLocaleString();
        this.valPctFacebook.textContent = `${pct.Facebook}%`;
        this.barFacebook.style.width = `${pct.Facebook}%`;

        this.valInstagram.textContent = counts.Instagram.toLocaleString();
        this.valPctInstagram.textContent = `${pct.Instagram}%`;
        this.barInstagram.style.width = `${pct.Instagram}%`;

        // 3. วาดกราฟ Daily Trend
        this.renderTrendChart();

        // 4. วาดตารางแสดงประวัติ
        this.renderLogsTable();
    }

    // วาดกราฟ Daily Trend ด้วย Chart.js
    renderTrendChart() {
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        // 1. จัดเตรียมข้อมูลสำหรับแกน X และ Y ของกราฟ
        // เราต้องการจับกลุ่มการคลิกตามวันที่
        const dateGroup = {};
        
        // ตรวจสอบข้อมูลเพื่อหาช่วงวันทั้งหมดที่ควรแสดงในกราฟ
        let daysToGenerate = [];
        const now = new Date();

        if (this.currentRange === "today") {
            // ถ้าเป็นวันนี้ แสดงกราฟแยกตามชั่วโมง (24 ชม.)
            for (let i = 0; i < 24; i++) {
                const hourStr = `${String(i).padStart(2, '0')}:00`;
                dateGroup[hourStr] = { LINE: 0, TikTok: 0, Facebook: 0, Instagram: 0, total: 0 };
                daysToGenerate.push(hourStr);
            }
            
            this.filteredClicks.forEach(item => {
                const hour = item.timestamp.split(" ")[1].split(":")[0];
                const hourStr = `${hour}:00`;
                if (dateGroup[hourStr]) {
                    dateGroup[hourStr][item.social]++;
                    dateGroup[hourStr].total++;
                }
            });
        } else {
            // สำหรับช่วงฟิลเตอร์อื่นๆ แสดงแยกตามวัน (เช่น 7 วันย้อนหลัง หรือช่วงที่เลือก)
            let startDate, endDate;
            
            if (this.currentRange === "7days") {
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                startDate = new Date(endDate.getTime() - (6 * 24 * 60 * 60 * 1000));
            } else if (this.currentRange === "30days") {
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                startDate = new Date(endDate.getTime() - (29 * 24 * 60 * 60 * 1000));
            } else { // Custom Range
                const startStr = this.startDateInput.value;
                const endStr = this.endDateInput.value;
                startDate = new Date(startStr);
                endDate = new Date(endStr);
            }

            // สร้าง Array ของวันที่ทั้งหมดในช่วง
            const tempDate = new Date(startDate);
            while (tempDate <= endDate) {
                // แปลงเป็นรูปแบบ dd/MM (เช่น 24/06) สำหรับป้ายกราฟ
                const label = `${String(tempDate.getDate()).padStart(2, '0')}/${String(tempDate.getMonth() + 1).padStart(2, '0')}`;
                dateGroup[label] = { LINE: 0, TikTok: 0, Facebook: 0, Instagram: 0, total: 0 };
                daysToGenerate.push(label);
                tempDate.setDate(tempDate.getDate() + 1);
            }

            // นับสถิติตามวัน
            this.filteredClicks.forEach(item => {
                const parts = item.timestamp.split(" ")[0].split("-"); // yyyy-MM-dd
                const label = `${parts[2]}/${parts[1]}`; // dd/MM
                if (dateGroup[label]) {
                    dateGroup[label][item.social]++;
                    dateGroup[label].total++;
                }
            });
        }

        // ดึงข้อมูลแยกตามแพลตฟอร์มเพื่อส่งเข้า Chart.js
        const lineData = [];
        const tiktokData = [];
        const facebookData = [];
        const instagramData = [];
        const totalData = [];

        daysToGenerate.forEach(day => {
            lineData.push(dateGroup[day].LINE);
            tiktokData.push(dateGroup[day].TikTok);
            facebookData.push(dateGroup[day].Facebook);
            instagramData.push(dateGroup[day].Instagram);
            totalData.push(dateGroup[day].total);
        });

        // 2. ตั้งค่าและสร้าง Chart.js
        const ctx = document.getElementById("trendChart").getContext("2d");
        
        // สร้างการไล่เฉดสีพรีเมียมสีแบรนด์ KMA สำหรับคลิกทั้งหมด
        const gradient = ctx.createLinearGradient(0, 0, 0, 280);
        gradient.addColorStop(0, "rgba(201, 139, 111, 0.22)");
        gradient.addColorStop(1, "rgba(201, 139, 111, 0.00)");

        this.chartInstance = new Chart(ctx, {
            type: "line", // กราฟเส้นไล่เฉดเรียบหรูสไตล์โมเดิร์น
            data: {
                labels: daysToGenerate,
                datasets: [
                    {
                        label: "คลิกทั้งหมด",
                        data: totalData,
                        borderColor: "#C98B6F",
                        borderWidth: 3,
                        backgroundColor: gradient,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: "#C98B6F",
                        pointBorderColor: "#FFFFFF",
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        order: 0
                    },
                    {
                        label: "LINE",
                        data: lineData,
                        borderColor: "rgba(40, 167, 69, 0.8)", // เขียวหรู
                        borderWidth: 1.8,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 1,
                        pointHoverRadius: 4,
                        order: 1
                    },
                    {
                        label: "TikTok",
                        data: tiktokData,
                        borderColor: "rgba(34, 34, 34, 0.8)", // ดำมินิมอล
                        borderWidth: 1.8,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 1,
                        pointHoverRadius: 4,
                        order: 1
                    },
                    {
                        label: "Facebook",
                        data: facebookData,
                        borderColor: "rgba(24, 119, 242, 0.8)", // น้ำเงินหรู
                        borderWidth: 1.8,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 1,
                        pointHoverRadius: 4,
                        order: 1
                    },
                    {
                        label: "Instagram",
                        data: instagramData,
                        borderColor: "rgba(225, 48, 108, 0.8)", // ชมพูพีชหรู
                        borderWidth: 1.8,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 1,
                        pointHoverRadius: 4,
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "top",
                        labels: {
                            font: { family: "Noto Sans Thai", size: 11 },
                            boxWidth: 10,
                            usePointStyle: true,
                            padding: 15
                        }
                    },
                    tooltip: {
                        mode: "index",
                        intersect: false,
                        titleFont: { family: "Noto Sans Thai" },
                        bodyFont: { family: "Noto Sans Thai" }
                    }
                },
                scales: {
                    x: {
                        stacked: false, // ปิดการ stack เพื่อความง่ายในการอ่านระดับข้อมูล
                        ticks: { font: { family: "Noto Sans Thai", size: 10 } },
                        grid: { display: false }
                    },
                    y: {
                        stacked: false, // ปิดการ stack
                        beginAtZero: true,
                        ticks: { 
                            font: { family: "Noto Sans Thai", size: 10 },
                            stepSize: this.currentRange === "today" ? 1 : undefined 
                        },
                        grid: {
                            color: "rgba(0, 0, 0, 0.04)",
                            drawBorder: false
                        }
                    }
                }
            }
        });
    }

    // วาดตารางประวัติการคลิกแบบแบ่งหน้า
    renderLogsTable() {
        const total = this.filteredClicks.length;
        
        // เคลียร์ตาราง
        this.logsTableBody.innerHTML = "";

        if (total === 0) {
            this.logsTableBody.innerHTML = `
                <tr>
                    <td colspan="3" class="empty-message">ไม่พบข้อมูลคลิกในสถิติตามเงื่อนไขปัจจุบัน</td>
                </tr>
            `;
            this.paginationText.textContent = "แสดง 0 ถึง 0 จาก 0 รายการ";
            this.prevPageBtn.disabled = true;
            this.nextPageBtn.disabled = true;
            return;
        }

        // คำนวณขอบเขตหน้าปัจจุบัน
        const maxPage = Math.ceil(total / this.itemsPerPage);
        if (this.currentPage > maxPage) this.currentPage = maxPage;
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, total);

        // ดึงเฉพาะรายการที่จะแสดงในหน้านั้นๆ
        const pageItems = this.filteredClicks.slice(startIndex, endIndex);

        // วนลูปเพื่อสรุปแถวตาราง
        pageItems.forEach((item, index) => {
            const rowNumber = total - (startIndex + index); // นับลำดับถอยหลัง
            
            // สร้าง badge สำหรับช่องทางต่างๆ เพื่อความสวยงาม พร้อม SVG ไอคอน
            let badgeClass = "";
            let svgIcon = "";
            if (item.social === "LINE") {
                badgeClass = "badge-line";
                svgIcon = `<svg viewBox="0 0 16 16" style="width: 12px; height: 12px; margin-right: 6px; fill: currentColor;"><path d="M9.048 5.727c0-.282.229-.511.512-.511h1.246a.512.512 0 1 1 0 1.022H9.56v1.671h1.246a.512.512 0 1 1 0 1.022H9.56v1.73h1.246a.512.512 0 1 1 0 1.022H9.56a.512.512 0 0 1-.512-.512V5.727zM0 8c0 4.41 3.59 8 8 8 4.41 0 8-3.59 8-8s-3.59-8-8-8C3.59 0 0 3.59 0 8zm8.115-3.332a.498.498 0 0 1 .498.498v5.668a.498.498 0 0 1-.996 0V5.166a.498.498 0 0 1 .498-.498zm-4.004.498v5.668c0 .275-.223.498-.498.498H2.33a.498.498 0 0 1-.498-.498V5.166c0-.275.223-.498.498-.498a.498.498 0 0 1 .498.498v5.17h1.283zm1.968-.498a.498.498 0 0 1 .38.188l2.001 3.036v-2.726a.498.498 0 1 1 .996 0v5.668a.498.498 0 0 1-.383-.188l-1.998-3.035v2.725a.498.498 0 1 1-.996 0V5.166a.498.498 0 0 1 .498-.498z"/></svg>`;
            } else if (item.social === "TikTok") {
                badgeClass = "badge-tiktok";
                svgIcon = `<svg viewBox="0 0 24 24" style="width: 12px; height: 12px; margin-right: 6px; fill: currentColor;"><path d="M12.525.02c1.31-.03 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.52-4.06-1.39-.77-.57-1.39-1.33-1.89-2.18v7.58c.02 1.83-.53 3.69-1.72 5.07-1.45 1.75-3.88 2.62-6.13 2.22-2.28-.35-4.32-2.02-5.06-4.22-.96-2.73-.24-6.06 1.89-7.98 1.6-1.49 3.86-2.17 6-1.77v4.1c-1.12-.34-2.39-.08-3.23.74-.83.78-1.11 2.05-.68 3.12.39 1.05 1.51 1.78 2.62 1.71 1.25.02 2.37-.91 2.53-2.15.06-.5.03-1.02.03-1.52V.02z"/></svg>`;
            } else if (item.social === "Facebook") {
                badgeClass = "badge-facebook";
                svgIcon = `<svg viewBox="0 0 24 24" style="width: 12px; height: 12px; margin-right: 6px; fill: currentColor;"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`;
            } else if (item.social === "Instagram") {
                badgeClass = "badge-instagram";
                svgIcon = `<svg viewBox="0 0 24 24" style="width: 12px; height: 12px; margin-right: 6px; fill: currentColor;"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>`;
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>#${rowNumber}</td>
                <td>${item.timestamp}</td>
                <td><span class="table-badge ${badgeClass}">${svgIcon}${item.social}</span></td>
            `;
            this.logsTableBody.appendChild(tr);
        });

        // อัปเดตข้อความ Pagination
        this.paginationText.textContent = `แสดง ${startIndex + 1} ถึง ${endIndex} จากทั้งหมด ${total} รายการ`;

        // เปิด/ปิด การใช้งานปุ่มแบ่งหน้า
        this.prevPageBtn.disabled = this.currentPage === 1;
        this.nextPageBtn.disabled = this.currentPage === maxPage;
    }

    // กรอกลิงก์ล่าสุดในฟิลด์นำเข้าข้อมูล
    populateSettingsForm(links) {
        if (!links) return;
        if (this.linkLine) this.linkLine.value = links.LINE || "";
        if (this.linkTiktok) this.linkTiktok.value = links.TikTok || "";
        if (this.linkFacebook) this.linkFacebook.value = links.Facebook || "";
        if (this.linkInstagram) this.linkInstagram.value = links.Instagram || "";
    }

    // บันทึกการแก้ไขลิงก์โซเชียลมีเดีย
    handleSaveLinks() {
        const password = this.getPassword();
        if (!password) {
            alert("เซสชันหมดอายุ กรุณาล็อกอินใหม่อีกครั้ง");
            this.handleLogout();
            return;
        }

        const updatedLinks = {
            LINE: this.linkLine.value.trim(),
            TikTok: this.linkTiktok.value.trim(),
            Facebook: this.linkFacebook.value.trim(),
            Instagram: this.linkInstagram.value.trim()
        };

        this.setSettingsLoading(true);
        this.updateSettingsStatus("กำลังบันทึกข้อมูลลิงก์...", "info");

        if (!GAS_API_URL) {
            // โหมดเดโมจำลองสำเร็จ
            setTimeout(() => {
                this.setSettingsLoading(false);
                this.updateSettingsStatus("บันทึกการตั้งค่าลิงก์ในโหมดเดโมสำเร็จ!", "success");
                console.log("บันทึกในโหมด Demo เรียบร้อย (Mock):", updatedLinks);
            }, 800);
        } else {
            // ส่งข้อมูลจริงไปยัง GAS
            fetch(GAS_API_URL, {
                method: "POST",
                mode: "cors",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify({
                    action: "saveLinks",
                    password: password,
                    links: updatedLinks
                })
            })
            .then(response => response.json())
            .then(data => {
                this.setSettingsLoading(false);
                if (data.success) {
                    this.updateSettingsStatus("บันทึกลิงก์ลง Google Sheet สำเร็จ!", "success");
                    setTimeout(() => {
                        this.updateSettingsStatus("", "");
                    }, 4000);
                } else {
                    this.updateSettingsStatus(`ล้มเหลว: ${data.error || "Unknown error"}`, "error");
                }
            })
            .catch(error => {
                this.setSettingsLoading(false);
                this.updateSettingsStatus(`เกิดข้อผิดพลาดในการบันทึก: ${error.message || error}`, "error");
            });
        }
    }

    setSettingsLoading(isLoading) {
        if (isLoading) {
            this.settingsSpinner.classList.remove("hidden");
            this.saveSettingsBtn.disabled = true;
            this.saveSettingsBtn.querySelector("span").textContent = "กำลังบันทึก...";
        } else {
            this.settingsSpinner.classList.add("hidden");
            this.saveSettingsBtn.disabled = false;
            this.saveSettingsBtn.querySelector("span").textContent = "บันทึกการตั้งค่าลิงก์";
        }
    }

    updateSettingsStatus(msg, type) {
        this.settingsStatusMsg.textContent = msg;
        this.settingsStatusMsg.className = "settings-status-msg"; // รีเซ็ตคลาส
        if (type) {
            this.settingsStatusMsg.classList.add(type);
        }
    }
}

// เริ่มต้นเปิดใช้งานคลาสแดชบอร์ดเมื่อเอกสารพร้อม
document.addEventListener("DOMContentLoaded", () => {
    window.kmaDashboard = new AdminDashboard();
});
