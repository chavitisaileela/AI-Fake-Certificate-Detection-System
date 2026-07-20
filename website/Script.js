// =========================================================================
// 1. GLOBAL SETUP, CONFIGURATIONS & SIMULATION LAYERS
// =========================================================================
const API_URL = "http://127.0.0.1:5000";

let generatedOTP = null;
let cachedScanRecords = [];
let dashboardBarChartInstance = null;
let dashboardLineChartInstance = null;
let gaugeChartInstance = null;
let confidenceChartInstance = null;
let localMediaStream = null;

const MOCK_DATA = {
    metrics: { totalScanned: 1248, genuineClearances: 1182, fraudAlerts: 66 },
    timeline: [
        { cert_id: "TXN-9021-A8", filename: "academic_degree_v2.pdf", timestamp: "2026-06-20 00:14:22", confidence: 99.4, status: "GENUINE", recipient: "Alice Vance", issuer: "State Tech University", issue_date: "2024-05-12", ocr_text: "UNIVERSITY SEAL VALIDATED\nDEGREE: Bachelor of Computer Science\nGRADUATE: Alice Vance\nSTATUS: VERIFIED" },
        { cert_id: "TXN-4481-B2", filename: "employment_record_johnson.pdf", timestamp: "2026-06-19 22:45:10", confidence: 34.1, status: "FRAUD", recipient: "Mark Johnson", issuer: "Global Corp Logistics", issue_date: "2025-11-01", ocr_text: "METADATA TAMPERING DETECTED\nFONT MISMATCH ON EMISSION \nDATE\nCLAIMED POSITION: Senior VP" },
        { cert_id: "TXN-1102-X9", filename: "medical_cert_scan.jpg", timestamp: "2026-06-19 19:30:15", confidence: 97.8, status: "GENUINE", recipient: "Sarah Jenkins", issuer: "City General Hospital", issue_date: "2026-02-14", ocr_text: "MEDICAL EXAM CONFIRMED\nDOCTOR SIGNATURE: Dr. R. Miller\nSTAMP: VALID" }
    ],
    charts: {
        months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        scans: [140, 190, 230, 210, 240, 238],
        frauds: [5, 12, 8, 15, 11, 15],
        genuineRatio: [135, 178, 222, 195, 229, 223]
    }
};

// =========================================================================
// 2. SESSION AUTHENTICATION GUARD & REGISTRATION ENGINES
// =========================================================================
function checkSession() {
    const user = localStorage.getItem('app_user');
    const path = window.location.pathname;
    if (!user && !path.includes('login.html') && !path.includes('register.html')) {
        window.location.href = 'login.html';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role })
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('app_user', JSON.stringify(data.user));
            window.location.href = 'dashboard.html';
        } else {
            alert(data.message || "Invalid login details.");
        }
    } catch (err) {
        alert("Cannot connect to login server.");
    }
}

function sendMockOTP() {
    const phoneInput = document.getElementById('phone');
    if (!phoneInput || !phoneInput.value.trim()) {
        alert("Please enter a phone number first!");
        return;
    }
    const phone = phoneInput.value.trim();
    generatedOTP = Math.floor(1000 + Math.random() * 9000).toString();
    alert(`[Verification Simulation]\nAn OTP code has been sent to ${phone}.\nYour Code is: ${generatedOTP}`);
}

function detectGeoCoordinates() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your current browser profile.");
        return;
    }
    
    const locationInput = document.getElementById('location');
    if (!locationInput) return;
    locationInput.placeholder = "Detecting address...";

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                const data = await response.json();
                
                if (data && data.address) {
                    const address = data.address;
                    
                    const city = address.city || 
                                 address.town || 
                                 address.village || 
                                 address.suburb || 
                                 address.neighbourhood ||
                                 address.municipality || 
                                 address.county || 
                                 address.state_district || 
                                 "Unknown City";
                                 
                    const country = address.country || "";
                    locationInput.value = `${city}, ${country}`;
                } else {
                    locationInput.value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
                }
            } catch (apiError) {
                locationInput.value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
            }
        },
        (error) => {
            locationInput.placeholder = "e.g. New York, USA";
            alert("Unable to fetch location automatically. Please input manually.");
        }
    );
}

async function handleRegister(e) {
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }

    const password = document.getElementById('password').value;
    const confirmPasswordInput = document.getElementById('confirm_password');
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : password;
    
    if (password !== confirmPassword) {
        alert("Registration passwords do not match!");
        return;
    }

    const first_name = document.getElementById('first_name').value;
    const last_name = document.getElementById('last_name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const role = document.getElementById('role').value;
    const locationField = document.getElementById('location');
    const location = locationField ? locationField.value : "";

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ first_name, last_name, email, phone, location, password, role })
        });
        const data = await res.json();
        
        if (res.ok || data.success) {
            alert(data.message || "Registration successful!");
            
            const localizedUserData = {
                first_name: first_name,
                last_name: last_name,
                email: email,
                phone: phone,
                role: role,
                saved_location: location,
                profile_pic: "" 
            };
            localStorage.setItem('app_user', JSON.stringify(localizedUserData));

            window.location.href = 'login.html';
        } else {
            alert(data.message || "Registration failed");
        }
    } catch (err) {
        alert("Cannot connect to the server. Please verify it is running.");
    }
}



// =========================================================================
// 3. CORE DASHBOARD ENGINE - LOADERS, CONTROLS & LOG FILTERS
//               Dashboard Page Script
// =========================================================================
async function loadDashboard() {
    checkSession();
    
    let dashboardData = null;
    try {
        const res = await fetch(`${API_URL}/dashboard`);
        if (res.ok) {
            dashboardData = await res.json();
        }
    } catch (err) {
        console.warn("Live server offline. Engaging local simulation fallback layers.", err);
    }

    const totalScanned = dashboardData?.scanned ?? MOCK_DATA.metrics.totalScanned;
    const genuineCount = dashboardData?.genuine ?? MOCK_DATA.metrics.genuineClearances;
    const fraudCount = dashboardData?.fraud ?? MOCK_DATA.metrics.fraudAlerts;

    if (document.getElementById('scannedCount')) document.getElementById('scannedCount').innerText = totalScanned;
    if (document.getElementById('genuineCount')) document.getElementById('genuineCount').innerText = genuineCount;
    if (document.getElementById('fakeCount')) document.getElementById('fakeCount').innerText = fraudCount;

    let combinedRecords = [];
    if (dashboardData?.recent && dashboardData.recent.length > 0) {
        combinedRecords = [...dashboardData.recent];
    }

    const localHistory = JSON.parse(localStorage.getItem("scanHistory")) || [];
    localHistory.forEach(localItem => {
        const matchTime = localItem.time || localItem.timestamp;
        const alreadyExists = combinedRecords.some(r => r.timestamp === matchTime || r.time === matchTime);
        if (!alreadyExists) {
            combinedRecords.push({
                filename: localItem.file || localItem.filename || "Screenshot 2025-03-09 153158.png",
                timestamp: matchTime || new Date().toLocaleString(),
                confidence: localItem.score || localItem.confidence || 60,
                status: localItem.status || "GENUINE",
                docType: localItem.docType || "Certificate",
                cert_id: "N/A", recipient: "N/A", issuer: "N/A", issue_date: "N/A", ocr_text: ""
            });
        }
    });

    if (combinedRecords.length < totalScanned) {
        const missingCount = totalScanned - combinedRecords.length;
        let currentGenuineInRecords = combinedRecords.filter(r => r.status.toUpperCase() === 'GENUINE').length;
        let currentFraudInRecords = combinedRecords.filter(r => r.status.toUpperCase() === 'FRAUD' || r.status.toUpperCase() === 'CRITICAL FRAUD').length;
        for (let i = 0; i < missingCount; i++) {
            let assignedStatus = "GENUINE";
            let assignedConfidence = 60;
            
            if (currentFraudInRecords < fraudCount) {
                assignedStatus = "FRAUD";
                assignedConfidence = 34;
                currentFraudInRecords++;
            } else {
                currentGenuineInRecords++;
            }

            let mockTime = new Date();
            mockTime.setMinutes(mockTime.getMinutes() - (i + 1) * 12); 
            const formattedTime = mockTime.toISOString().replace('T', ' ').substring(0, 19);
            combinedRecords.unshift({
                filename: `Screenshot 2025-03-09 1531${50 + (i % 9)}.png`,
                timestamp: formattedTime,
                confidence: assignedConfidence,
                status: assignedStatus,
                docType: "Certificate",
                cert_id: `TXN-AUTO-${1000 + i}`, recipient: "System Saved Log", issuer: "Local Repository Cache", issue_date: "2026-06-20", ocr_text: "RESTORED ANALYTICAL DATA NODE"
            });
        }
    }

    cachedScanRecords = combinedRecords;

    renderDashboardTable();
    initializeCharts(totalScanned, genuineCount, fraudCount, dashboardData === null);
}

function renderDashboardTable() {
    const tbody = document.getElementById('recentScansTable');
    if (tbody) {
        tbody.innerHTML = "";
        
        const slicerSelect = document.getElementById('statusSlicerSelect');
        const filterValue = slicerSelect ? slicerSelect.value : "all";

        const docTypeSelect = document.getElementById('docTypeSlicerSelect');
        const docTypeFilterValue = docTypeSelect ? docTypeSelect.value : "all";
        
        if (cachedScanRecords.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No documents scanned yet.</td></tr>`;
        } else {
            let serialDisplayNumber = 1;
            [...cachedScanRecords].reverse().forEach((item) => {
                const originalIndex = cachedScanRecords.indexOf(item);
                const isGenuine = item.status.toUpperCase() === 'GENUINE';
                
                if (filterValue === "genuine" && !isGenuine) return;
                if (filterValue === "fraud" && isGenuine) return;

                const itemDocType = (item.docType || 'certificate').toLowerCase();
                if (docTypeFilterValue !== "all" && itemDocType !== docTypeFilterValue) return;
                
                const fileIconClass = item.filename?.endsWith('.pdf') ? 'fa-file-pdf' : 'fa-file-image';
                
                const row = `<tr onclick="openCertificateDetails(${originalIndex})" style="cursor: pointer;" title="Click to view full certificate details">
                    <td style="color: #94a3b8; font-weight: 600;">${serialDisplayNumber}.</td>
                    <td><strong><i class="fa-regular ${fileIconClass}" style="color: #64748b; margin-right: 8px;"></i>${item.filename || 'Unknown Document'}</strong></td>
                    <td><span class="badge-type" style="padding: 4px 8px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: capitalize;">${item.docType || 'Certificate'}</span></td>
                    <td>${item.timestamp || 'N/A'}</td>
                    <td><span style="font-family: monospace; font-weight:600; color:${isGenuine ? '#48bb78' : '#f56565'};">${item.confidence}%</span></td>
                    <td><span style="padding: 4px 10px; border-radius: 4px; font-size:12px; font-weight: bold; background: ${isGenuine ? 'rgba(72,187,120,0.15)' : 'rgba(245,101,101,0.15)'}; color: ${isGenuine ? '#48bb78' : '#f56565'}; border: 1px solid ${isGenuine ? 'rgba(72,187,120,0.3)' : 'rgba(245,101,101,0.3)'};">${item.status.toUpperCase()}</span></td>
                </tr>`;
                tbody.innerHTML += row;
                serialDisplayNumber++;
            });
            
            if (tbody.innerHTML === "") {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No records matched your selected slicer option.</td></tr>`;
            }
        }
    }
}

function filterDashboardTable(term) {
    const tbody = document.getElementById('recentScansTable');
    if (!tbody || !cachedScanRecords) return;
    const filteredRecords = cachedScanRecords.filter(item => {
        const filename = (item.filename || '').toLowerCase();
        const timestamp = (item.timestamp || '').toLowerCase();
        const status = (item.status || '').toLowerCase();
        const docType = (item.docType || '').toLowerCase();
        return filename.includes(term) || timestamp.includes(term) || status.includes(term) || docType.includes(term);
    });
    tbody.innerHTML = "";
    if (filteredRecords.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding: 20px;">No matching scan logs found.</td></tr>`;
        return;
    }

    [...filteredRecords].reverse().forEach((item, displayIndex) => {
        const originalIndex = cachedScanRecords.indexOf(item);
        const isGenuine = item.status.toUpperCase() === 'GENUINE';
        const fileIconClass = item.filename?.endsWith('.pdf') ? 'fa-file-pdf' : 'fa-file-image';
        const serialDisplayNumber = displayIndex + 1;
        
        const row = `<tr onclick="openCertificateDetails(${originalIndex})" style="cursor: pointer;" title="Click to view full certificate details">
            <td style="color: #94a3b8; font-weight: 600;">${serialDisplayNumber}.</td>
            <td><strong><i class="fa-regular ${fileIconClass}" style="color: #64748b; margin-right: 8px;"></i>${item.filename || 'Unknown Document'}</strong></td>
            <td><span class="badge-type" style="padding: 4px 8px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: capitalize;">${item.docType || 'Certificate'}</span></td>
            <td>${item.timestamp || 'N/A'}</td>
            <td><span style="font-family: monospace; font-weight:600; color:${isGenuine ? '#48bb78' : '#f56565'};">${item.confidence}%</span></td>
            <td><span style="padding: 4px 10px; border-radius: 4px; font-size:12px; font-weight: bold; background: ${isGenuine ? 'rgba(72,187,120,0.15)' : 'rgba(245,101,101,0.15)'}; color: ${isGenuine ? '#48bb78' : '#f56565'}; border: 1px solid ${isGenuine ? 'rgba(72,187,120,0.3)' : 'rgba(245,101,101,0.3)'};">${item.status.toUpperCase()}</span></td>
        </tr>`;
        tbody.innerHTML += row;
    });
}


// =========================================================================
// 4. SCAN VERIFICATION WORKFLOWS & MODAL INJECTORS                 
//     Verification Page Script
// =========================================================================
async function handleVerify(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const fileInput = document.getElementById('certFile');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        alert("Please choose a certificate file to scan first.");
        return;
    }
    const targetedFile = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', targetedFile);
    
    const selectedCategory = document.getElementById('selectedDocCategory')?.value || 'other';
    formData.append('category', selectedCategory);

    let computedLocalPreview = "";
    if (targetedFile.type.startsWith('image/')) {
        computedLocalPreview = URL.createObjectURL(targetedFile);
    }
    const loadingEl = document.getElementById('loadingText');
    const submitBtn = document.getElementById('btnSubmitVerify');
    const detailLink = document.getElementById('viewDetailsLink');
    if (loadingEl) loadingEl.style.display = "block";
    if (submitBtn) submitBtn.disabled = true;
    try {
        const res = await fetch(`${API_URL}/verify`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            const textToAnalyze = (data.ocr_text || data.text || "").toLowerCase();
            const keywords = ["certificate", "marksheet", "internship", "diploma", "degree", "course", "grade", "result", "transcript", "graduation"];
            const isValidDocument = keywords.some(keyword => textToAnalyze.includes(keyword));
            if (!isValidDocument) {
                alert("Error: Upload a valid certificate. The system could not match structural standard signatures.");
                if (loadingEl) loadingEl.style.display = "none";
                if (submitBtn) submitBtn.disabled = false;
                return;
            }
            
            let rawScore = data.confidence ?? data.score ?? data.match_rate ?? 0;
            let finalScore = parseFloat(rawScore) || 0;
            const scanRecordObject = {
                filename: targetedFile.name,
                timestamp: data.timestamp || new Date().toLocaleString(),
                confidence: finalScore,
                status: data.status || "GENUINE",
                docType: selectedCategory,
                cert_id: data.cert_id || data.certificate_id || "N/A",
                recipient: data.recipient || data.candidate_name || "N/A",
                issuer: data.issuer || data.organization || "N/A",
                issue_date: data.issue_date || data.date || "N/A",
                ocr_text: data.ocr_text || data.text || "",
                filePreviewUrl: computedLocalPreview
            };
            localStorage.setItem('lastScanResult', JSON.stringify(scanRecordObject));
            cachedScanRecords.push(scanRecordObject);
            
            const localHistory = JSON.parse(localStorage.getItem("scanHistory")) || [];
            localHistory.push({
                file: scanRecordObject.filename,
                time: scanRecordObject.timestamp,
                score: scanRecordObject.confidence,
                status: scanRecordObject.status,
                docType: scanRecordObject.docType
            });
            localStorage.setItem("scanHistory", JSON.stringify(localHistory));

            const fallbackTextEl = document.getElementById('gaugePercentText') || document.getElementById('confidencePercent');
            if (fallbackTextEl) fallbackTextEl.innerText = `${finalScore}%`;
            if (document.getElementById('confidenceGaugeCanvas')) {
                initGaugeChart(finalScore);
            }
            if (detailLink) detailLink.style.visibility = "visible";
            if (loadingEl) loadingEl.style.display = "none";
            if (submitBtn) submitBtn.disabled = false;
            alert(`Scan Completed Successfully! Final Verdict: ${data.status || 'Processed'}.`);
            if (window.location.pathname.includes('dashboard.html')) {
                loadDashboard();
            }
        } else {
            alert(data.message || "Document scanner processing validation error.");
            if (loadingEl) loadingEl.style.display = "none";
            if (submitBtn) submitBtn.disabled = false;
        }
    } catch (err) {
        console.error("Scan Error Details:", err);
        alert("Scan connection error. Verify your backend environment console is running.");
        if (loadingEl) loadingEl.style.display = "none";
        if (submitBtn) submitBtn.disabled = false;
    }
}

function displaySelectedFile(input) {
    const box = document.getElementById('fileDetailsBox');
    const nameField = document.getElementById('infoFileName');
    const sizeField = document.getElementById('infoFileSize');
    const icon = document.getElementById('uploadIcon');
    const instructions = document.getElementById('uploadInstructions'); 
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (nameField) nameField.innerText = file.name;
        if (sizeField) sizeField.innerText = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;     
        if (box) box.style.display = 'block';
        if (icon) {
            icon.className = "fa-solid fa-file-shield fa-3x";
            icon.style.color = "#38bdf8";
        }
        if (instructions) instructions.innerText = "File selected. Ready to verify.";
    } else {
        if (box) box.style.display = 'none';
        if (icon) {
            icon.className = "fa-solid fa-cloud-arrow-up fa-3x";
            icon.style.color = "#64748b";
        }
        if (instructions) instructions.innerText = "Supports certificate, marksheet, or internship documents";
    }
}

function runVerificationScan(event) {
    event.preventDefault();
    document.getElementById('loadingText').style.display = 'block';
    setTimeout(() => {
        document.getElementById('loadingText').style.display = 'none';
        document.getElementById('viewDetailsLink').style.display = 'inline-block';
        const mockScoreResult = 85; 
        updateConfidenceDonut(mockScoreResult);
    }, 2000);
}

function openCertificateDetails(recordIndex) {
    const item = cachedScanRecords[recordIndex];
    if (!item) return;
    const isGenuine = item.status ? item.status.toUpperCase() === 'GENUINE' : false;
    document.getElementById('modalFilename').innerText = item.filename || "Scanned_Document.png";
    document.getElementById('modalTime').innerText = `Scanned Event Target Logged: ${item.timestamp || item.time || 'N/A'}`;
    document.getElementById('modalConfidence').innerText = `${item.confidence ?? 0}%`;
    document.getElementById('modalCertId').innerText = item.cert_id || "N/A";
    document.getElementById('modalRecipient').innerText = item.recipient || "N/A";
    document.getElementById('modalIssuer').innerText = item.issuer || "N/A";
    document.getElementById('modalIssueDate').innerText = item.issue_date || "N/A";
    const statusLabel = document.getElementById('modalStatus');
    const displayStatus = item.status ? item.status.toUpperCase() : "UNKNOWN";
    statusLabel.innerText = displayStatus;
    statusLabel.style.color = isGenuine ? '#48bb78' : '#f56565';
    statusLabel.style.background = isGenuine ? 'rgba(72,187,120,0.15)' : 'rgba(245,101,101,0.15)';
    statusLabel.style.border = `1px solid ${isGenuine ? '#48bb78' : '#f56565'}`;
    document.getElementById('modalConfidence').style.color = isGenuine ? '#48bb78' : '#f56565';
    document.getElementById('modalOcrText').value = item.ocr_text || "No OCR string logs extracted from target asset file.";
    const iconContainer = document.getElementById('modalFileIcon')?.parentElement;
    if (iconContainer) {
        if (item.filePreviewUrl) {
            iconContainer.innerHTML = `<img src="${item.filePreviewUrl}" id="modalFileIcon" style="max-width: 100%; max-height: 130px; border-radius: 6px; object-fit: contain; margin-bottom: 10px; border: 1px solid #334155;" />`;
        } else {
            const isPdf = item.filename ? item.filename.toLowerCase().endsWith('.pdf') : false;
            iconContainer.innerHTML = `<i class="${isPdf ? 'fa-solid fa-file-pdf' : 'fa-solid fa-file-image'} fa-4x" style="color: ${isGenuine ? '#48bb78' : '#f56565'}; margin-bottom: 10px;" id="modalFileIcon"></i>`;
        }
    }
    document.getElementById('detailsModal').style.display = "flex";
}

function closeModal() {
    document.getElementById('detailsModal').style.display = "none";
}

window.onclick = function(event) {
    const modal = document.getElementById('detailsModal');
    if (event.target === modal) {
        modal.style.display = "none";
    }
};


// =========================================================================
// 5. PROFILE INTERFACES & HARDWARE MEDIA STREAM CHANNELS                       
//                Profile Page Script
// =========================================================================
function loadProfile() {
    let user = JSON.parse(localStorage.getItem('app_user'));
    
    if (!user) {
        user = {
            first_name: "Chaviti",
            last_name: "Sai Leela",
            email: "sai.leela@guardai.io",
            phone: "+91 98765 43210",
            role: "Security Analyst",
            saved_location: "Tirupati, India",
            avatar: "👨‍💻"
        };
    }

    const full_name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    
    if (document.getElementById('profName')) document.getElementById('profName').innerHTML = `👤 ${full_name}`;
    if (document.getElementById('profEmail')) document.getElementById('profEmail').innerHTML = `✉️ ${user.email || "No Email Registered"}`;
    if (document.getElementById('profPhone')) document.getElementById('profPhone').innerHTML = `📞 ${user.phone || "-"}`;
    if (document.getElementById('profRole')) document.getElementById('profRole').innerHTML = `💼 ${user.role || "Admin Panel"}`;
    
    if (document.getElementById('savedLocationDisplay')) {
        document.getElementById('savedLocationDisplay').innerHTML = `📍 ${user.saved_location || user.location || "Not Provided"}`;
    }
    
    if (document.getElementById('location')) {
        document.getElementById('location').value = user.saved_location || user.location || "";
    } else if (document.getElementById('locationInput')) {
        document.getElementById('locationInput').value = user.saved_location || user.location || "";
    }  
    
    if (document.getElementById('bannerName')) document.getElementById('bannerName').innerText = full_name;
    if (document.getElementById('bannerEmail')) document.getElementById('bannerEmail').innerText = user.email || "";
    
    updateAvatarDisplay(user.profile_pic || user.avatar || "");
}

function updateAvatarDisplay(avatarValue) {
    const avatarBox = document.getElementById('bannerAvatar');
    const user = JSON.parse(localStorage.getItem('app_user'));
    const name = user ? (user.first_name || user.name || "C") : "C";
    const initialCharacter = name.charAt(0).toUpperCase();
    if (avatarBox) {
        if (!avatarValue) {
            avatarBox.innerHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#38bdf8; color:#0f172a; font-weight:bold; font-size:32px;">${initialCharacter}</div>`;
        } else if (avatarValue.startsWith('data:image') || avatarValue.startsWith('http')) {
            avatarBox.innerHTML = `<img src="${avatarValue}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" alt="User Photo">`;
        } else {
            avatarBox.innerHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:50px; background:#1e293b; border-radius:50%; line-height: 1;">${avatarValue}</div>`;
        }
    }
    
    const navImageElement = document.getElementById('sidebarAvatarContainer');
    if (navImageElement) {
        if (!avatarValue) {
            navImageElement.innerHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#38bdf8; color:#0f172a; font-weight:bold; font-size:16px;">${initialCharacter}</div>`;
        } else if (avatarValue.startsWith('data:image') || avatarValue.startsWith('http')) {
            navImageElement.innerHTML = `<img id="topUserNavAvatar" src="${avatarValue}" style="width: 100%; height: 100%; object-fit: cover; border-radius:50%;" alt="User Profile">`;
        } else {
            navImageElement.innerHTML = `<div style="font-size: 22px; line-height: 1; display:flex; align-items:center; justify-content:center; width:100%; height:100%;">${avatarValue}</div>`;
        }
    }
}

function saveNewProfilePicture(selectedAvatarValue) {
    let user = JSON.parse(localStorage.getItem('app_user')) || {};
    user.avatar = selectedAvatarValue;
    user.profile_pic = selectedAvatarValue; 
    localStorage.setItem('app_user', JSON.stringify(user));
    updateAvatarDisplay(selectedAvatarValue);
    syncBannerHeaderElements();
}

function openAvatarModal() { 
    const modal = document.getElementById('avatarPickerModal');
    if (modal) modal.style.display = 'flex';
}

function closeAvatarModal() { 
    stopWebcamStream();
    const modal = document.getElementById('avatarPickerModal');
    if (modal) modal.style.display = 'none';
}

function removeCurrentPhoto() {
    saveNewProfilePicture("");
    closeAvatarModal();
    alert("Profile picture removed successfully.");
}

async function startWebcam() {
    const videoElement = document.getElementById('webcamVideo');
    const streamContainer = document.getElementById('cameraStreamContainer');
    const defaultOptions = document.getElementById('defaultUploadOptions');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Camera feature is blocked! Ensure you are using localhost, 127.0.0.1, or an HTTPS connection.");
        return;
    }
    try {
        if (localMediaStream) {
            stopWebcamStream();
        }
        localMediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user" }, 
            audio: false 
        });
        if (videoElement) {
            videoElement.srcObject = localMediaStream;
            videoElement.play().catch(e => console.log("Video play interrupted:", e));
        }
        if (streamContainer) streamContainer.style.display = "block";
        if (defaultOptions) defaultOptions.style.display = "none";
    } catch (err) {
        console.error("Webcam access error:", err);
        alert("Could not access your webcam. Please verify your browser hardware permissions.");
    }
}

function captureSnapshot() {
    const video = document.getElementById('webcamVideo');
    if (!video || !localMediaStream) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const context = canvas.getContext('2d');
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Data = canvas.toDataURL('image/jpeg'); 
    saveNewProfilePicture(base64Data);
    stopWebcamStream();
    closeAvatarModal();
}

function stopWebcamStream() {
    if (localMediaStream) {
        localMediaStream.getTracks().forEach(track => track.stop());
        localMediaStream = null;
    }
    const videoElement = document.getElementById('webcamVideo');
    if (videoElement) videoElement.srcObject = null;
    const streamContainer = document.getElementById('cameraStreamContainer');
    const defaultOptions = document.getElementById('defaultUploadOptions');
    if (streamContainer) streamContainer.style.display = "none";
    if (defaultOptions) defaultOptions.style.display = "flex";
}

function handleSaveLocation(e) {
    if (e) e.preventDefault(); 
    const inputField = document.getElementById('location') || document.getElementById('locationInput');
    if (!inputField) return;
    const enteredLocation = inputField.value.trim();
    if (!enteredLocation) {
        alert("Please enter a valid city, country, or coordinate value first.");
        return;
    }
    
    let user = JSON.parse(localStorage.getItem('app_user')) || {};
    user.saved_location = enteredLocation;
    localStorage.setItem('app_user', JSON.stringify(user));
    const displayField = document.getElementById('savedLocationDisplay');
    if (displayField) {
        displayField.innerHTML = `📍 ${enteredLocation}`;
    }
    alert("System Location updated successfully!");
}

function handleAutoDetectLocation(e) {
    if (e) e.preventDefault();
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser software.");
        return;
    }
    
    const inputField = document.getElementById('location') || document.getElementById('locationInput');
    if (inputField) inputField.placeholder = "Detecting address...";
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                const data = await response.json();
                
                if (data && data.address) {
                    const address = data.address;
                    const city = address.city || 
                                 address.town || 
                                 address.village || 
                                 address.suburb || 
                                 address.neighbourhood ||
                                 address.municipality || 
                                 address.county || 
                                 address.state_district || 
                                 "Unknown City";
                                 
                    const country = address.country || "";
                    if (inputField) inputField.value = `${city}, ${country}`;
                } else {
                    if (inputField) inputField.value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
                }
            } catch (apiError) {
                if (inputField) inputField.value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
            }
        },
        (error) => {
            console.error("GPS Permission Flag Error:", error);
            if (inputField) inputField.placeholder = "e.g. Tirupati, India";
            alert("Could not access live system coordinates. Verify your browser location permissions.");
        }
    );
}

function syncBannerHeaderElements() {
    const nameEl = document.getElementById('profName');
    const emailEl = document.getElementById('profEmail');
    const loadedName = nameEl ? nameEl.innerText : "Chaviti Sai Leela";
    const loadedEmail = emailEl ? emailEl.innerText : "";
    if (document.getElementById('bannerName') && loadedName !== "Loading...") {
        document.getElementById('bannerName').innerText = loadedName.replace('👤 ', '').replace('📍 ', '').replace('✉️ ', '');
    }
    if (document.getElementById('bannerEmail') && loadedEmail !== "Loading...") {
        document.getElementById('bannerEmail').innerText = loadedEmail.replace('✉️ ', '');
    }
    const user = JSON.parse(localStorage.getItem('app_user'));
    if (user) {
        updateAvatarDisplay(user.profile_pic || user.avatar || "");
    }
}

function selectEmojiAvatar(emoji) {
    saveNewProfilePicture(emoji);
    closeAvatarModal();
}


// =========================================================================
// 6. ANOMALY THREAT ALERT MONITORS
//    Alerts / Security Page Script
// =========================================================================
async function loadAlertsViewData() {
    try {
        const tbody = document.getElementById('fraudAlertsTable');
        if (!tbody) return;
        tbody.innerHTML = "";

        let dashboardData = null;
        try {
            const res = await fetch(`${API_URL}/dashboard`);
            if (res.ok) {
                dashboardData = await res.json();
            }
        } catch (err) {
            console.warn("Live server offline. Engaging local simulation fallback layers for alerts view.", err);
        }

        const activeRecords = dashboardData?.recent || MOCK_DATA.timeline;
        const fraudItems = activeRecords.filter(item => item.status.toUpperCase() !== 'GENUINE' || item.confidence < 50);
        if (fraudItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding: 20px;">No critical fraud anomalies detected. Clear state.</td></tr>`;
            return;
        }

        [...fraudItems].reverse().forEach(item => {
            tbody.innerHTML += `<tr>
                <td><strong style="color:#f56565;"><i class="fa-solid fa-file-circle-xmark"></i> ${item.filename}</strong></td>
                <td>${item.timestamp}</td>
                <td><span style="font-weight:bold; color:#f56565;">${item.confidence}%</span></td>
                <td><span style="padding: 4px 10px; border-radius: 4px; font-size:12px; font-weight: bold; background: rgba(245,101,101,0.2); color: #f56565;">CRITICAL FRAUD</span></td>
            </tr>`;
        });
    } catch(e) {
        console.error("Failed loading alerts context view.", e);
    }
}

function loadLiveScanAlerts() {
    const alertsTable = document.getElementById('fraudAlertsTable');
    if (!alertsTable) return; 

    alertsTable.innerHTML = "";
    const scannedHistory = JSON.parse(localStorage.getItem("scanHistory")) || [];

    const fraudScans = scannedHistory.filter(item => {
        const itemStatus = item.status ? item.status.toUpperCase() : '';
        return itemStatus.includes('FRAUD') || itemStatus.includes('SUSPICIOUS') || itemStatus.includes('FORGERY');
    });

    if (fraudScans.length === 0) {
        alertsTable.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: #64748b; padding: 40px;">
                    <i class="fa-solid fa-shield-checkmark fa-2x" style="color: #48bb78; margin-bottom: 10px;"></i>
                    <br>No live fraud alerts caught in storage records.
                </td>
            </tr>`;
        return;
    }

    [...fraudScans].reverse().forEach((item) => {
        const row = document.createElement('tr');
        row.style.borderBottom = "1px solid #334155";
        
        const riskScore = item.score || item.confidence || 100;

        row.innerHTML = `
            <td style="padding: 14px 16px; font-weight: 600; color: #f1f5f9; display: flex; align-items: center; gap: 10px;">
                <i class="fa-solid fa-file-circle-exclamation" style="color: #f56565;"></i>
                ${item.file || item.filename || 'Scanned_Asset.png'}
            </td>
            <td style="padding: 14px 16px; color: #94a3b8;">
                ${item.time || item.timestamp || 'N/A'}
            </td>
            <td style="padding: 14px 16px; font-weight: 700; color: #f56565;">
                ${riskScore}% Risk
            </td>
            <td style="padding: 14px 16px;">
                <span style="background: rgba(245, 101, 101, 0.15); color: #f56565; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; border: 1px solid #f56565; text-transform: uppercase;">
                    ${item.status || 'FRAUD'}
                </span>
            </td>
        `;
        alertsTable.appendChild(row);
    });
}


// =========================================================================
// 7. GRAPH DATA VISUALIZATION SYSTEMS (RADIALS & METRICS)
//    Analytics & Charting Modules Script
// =========================================================================
function initializeCharts(total, genuine, fraud, isSimulationFallback) {
    const scansCanvas = document.getElementById('scansChart');
    const statusCanvas = document.getElementById('statusChart');

    if (scansCanvas && statusCanvas) {
        const scansCtx = scansCanvas.getContext('2d');
        const statusCtx = statusCanvas.getContext('2d');

        if (dashboardBarChartInstance) dashboardBarChartInstance.destroy();
        if (dashboardLineChartInstance) dashboardLineChartInstance.destroy();

        dashboardBarChartInstance = new Chart(scansCtx, {
            type: 'bar',
            data: {
                labels: MOCK_DATA.charts.months,
                datasets: [
                    {
                        label: 'Total Scans',
                        data: MOCK_DATA.charts.scans,
                        backgroundColor: '#38bdf8'
                    },
                    {
                        label: 'Fraud Alerts',
                        data: MOCK_DATA.charts.frauds,
                        backgroundColor: '#f56565'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });

        dashboardLineChartInstance = new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: ['Genuine Only', 'Fraud Caught'],
                datasets: [{
                    data: [genuine, fraud],
                    backgroundColor: ['#48bb78', '#f56565'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    } else {
        console.error("Chart canvas elements were not found in the DOM.");
    }
}

function initGaugeChart(percentScore) {
    const canvas = document.getElementById('confidenceGaugeCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const parsedScore = Math.min(Math.max(parseInt(percentScore) || 0, 0), 100);
    const remaining = 100 - parsedScore;
    let trackColor = '#38bdf8';
    if (parsedScore > 75) trackColor = '#48bb78'; 
    else if (parsedScore > 0 && parsedScore <= 50) trackColor = '#f56565';
    if (gaugeChartInstance) {
        gaugeChartInstance.data.datasets[0].data = [parsedScore, remaining];
        gaugeChartInstance.data.datasets[0].backgroundColor = [trackColor, '#334155'];
        gaugeChartInstance.update();
        if (document.getElementById('gaugePercentText')) {
            document.getElementById('gaugePercentText').innerText = `${parsedScore}%`;
        }
        return;
    }
    gaugeChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [parsedScore, remaining],
                backgroundColor: [trackColor, '#334155'],
                borderWidth: 0,
                borderRadius: parsedScore > 0 ? 4 : 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '83%',
            plugins: { tooltip: { enabled: false }, legend: { display: false } },
            rotation: 0
        }
    });
    if (document.getElementById('gaugePercentText')) {
        document.getElementById('gaugePercentText').innerText = `${parsedScore}%`;
    }
}

function updateConfidenceDonut(score) {
    const ctx = document.getElementById('confidenceDonutChart');
    const scoreTextElement = document.getElementById('donutMatchScoreText');
    if (!ctx) return;

    const cleanScore = Math.max(0, Math.min(100, Number(score) || 0));
    const remainder = 100 - cleanScore;

    if (scoreTextElement) {
        scoreTextElement.innerText = `${cleanScore}%`;
    }

    let gaugeColor = '#f56565';
    if (cleanScore >= 75) {
        gaugeColor = '#48bb78';
    } else if (cleanScore >= 40) {
        gaugeColor = '#ecc94b';
    }

    if (confidenceChartInstance) {
        confidenceChartInstance.destroy();
    }

    confidenceChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [cleanScore, remainder],
                backgroundColor: [gaugeColor, '#0f172a'],
                borderWidth: 0,
                borderRadius: cleanScore > 0 ? 8 : 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '82%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
}


// =========================================================================
// 8. GLOBAL ENGINE MANAGEMENT & DARK MODE UTILITIES
//  Utility Configurations & Global Theme Engines Script
// =========================================================================
function toggleThemeButton() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const themeBtn = document.getElementById('themeBtn');
    
    if (currentTheme === 'dark') {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        if (themeBtn) themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i> Switch to Dark Mode';
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        if (themeBtn) themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i> Switch to Light Mode';
    }
}

function selectDocumentCategory(categoryKey, categoryLabel) {
    const categoryInput = document.getElementById('selectedDocCategory');
    const displayLabel = document.getElementById('activeCategoryLabel');
    
    if (categoryInput) categoryInput.value = categoryKey;
    if (displayLabel) displayLabel.innerText = categoryLabel;

    const catWrapper = document.getElementById('categorySelectionWrapper');
    const uploadWrapper = document.getElementById('uploadFormWrapper');
    
    if (catWrapper) catWrapper.style.display = 'none';
    if (uploadWrapper) {
        uploadWrapper.style.display = uploadWrapper.className.includes('grid') ? 'grid' : 'block';
    }

    if (typeof initGaugeChart === "function") {
        initGaugeChart(0);
    }
}

function resetCategorySelection() {
    const fileInput = document.getElementById('certFile');
    if (fileInput) fileInput.value = ""; 
    displaySelectedFile(fileInput); 
    
    const uploadWrapper = document.getElementById('uploadFormWrapper');
    const catWrapper = document.getElementById('categorySelectionWrapper');
    
    if (uploadWrapper) uploadWrapper.style.display = 'none';
    if (catWrapper) catWrapper.style.display = 'block';
}

function handleImageFileSelect(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            saveNewProfilePicture(e.target.result);
            closeAvatarModal();
        };
        reader.readAsDataURL(input.files[0]);
    }
}


// =========================================================================
// 9. UNIFIED SYSTEM LIFECYCLE DOM MOUNT SEQUENCE
// Shared Application Initialization & Lifecycle DOM Sequence Script
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
    // A. Context Profile Configurations & Fallback States
    let storedUser = JSON.parse(localStorage.getItem('app_user'));
    if (!storedUser) {
        storedUser = {
            name: "Chaviti Sai Leela",
            first_name: "Chaviti",
            last_name: "Sai Leela",
            email: "sai.leela@guardai.io",
            phone: "+91 98765 43210",
            role: "Security Analyst",
            saved_location: "Tirupati, India",
            avatar: "👨‍💻",
            profile_pic: "https://i.pravatar.cc/150?img=33"
        };
        localStorage.setItem('app_user', JSON.stringify(storedUser));
    }

    if (window.location.pathname.toLowerCase().includes('profile.html')) {
        loadProfile();
    }

    const navNameElement = document.getElementById('topUserNavName');
    if (navNameElement) {
        navNameElement.innerText = storedUser.first_name || storedUser.name || "Chaviti Sai Leela";
    }
    updateAvatarDisplay(storedUser.profile_pic || storedUser.avatar || "");

    // B. Global Context Engine Themes
    const activeTheme = localStorage.getItem('theme') || 'light';
    const themeBtn = document.getElementById('themeBtn');
    if (activeTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeBtn) themeBtn.innerText = "Switch to Light Mode";
    } else {
        document.documentElement.removeAttribute('data-theme');
        if (themeBtn) themeBtn.innerText = "Switch to Dark Mode";
    }
    
    // C. Dashboard Validation Listeners & Slicer Select Components
    const isDashboard = window.location.pathname.includes('dashboard.html');
    if (isDashboard) {
        await loadDashboard();
        
        const slicerSelect = document.getElementById('statusSlicerSelect');
        if (slicerSelect) {
            slicerSelect.addEventListener('change', renderDashboardTable);
        }

        const docTypeSelect = document.getElementById('docTypeSlicerSelect');
        if (docTypeSelect) {
            docTypeSelect.addEventListener('change', renderDashboardTable);
        }
    } 

    // D. Global Live Dynamic Queries Listeners
    const searchInput = document.getElementById("dashboardSearchInput");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            filterDashboardTable(searchTerm);
        });
    }

    // E. Initialize Core Graphs View Layouts
    if (document.getElementById('confidenceDonutChart')) {
        updateConfidenceDonut(0);
    }
    if (document.getElementById('confidenceGaugeCanvas')) {
        initGaugeChart(0);
    }

    // F. Fire Storage Threat Interceptor Pipelines
    loadLiveScanAlerts();

    // G. Form Submission Binding Registrars
    const regForm = document.getElementById('regForm');
    if (regForm) {
        regForm.addEventListener('submit', function(e) {
            e.preventDefault(); 
            
            const otpInput = document.getElementById('otp_input');
            if (!otpInput) {
                handleRegister(e);
                return;
            }

            const userOTP = otpInput.value.trim();
            if (!generatedOTP) {
                alert("Please click 'Send OTP' first!");
                return;
            }
            if (userOTP !== generatedOTP) {
                alert("Invalid OTP code! Please try again.");
                return;
            }

            handleRegister(e);
        });
    }

    // H. Profile Page Specific Target Triggers (GPS Target and Location Form Updates)
    const gpsBtn = document.getElementById('gpsTargetBtn');
    if (gpsBtn) {
        gpsBtn.addEventListener('click', function() {
            const locationInput = document.getElementById('locationInput') || document.getElementById('location');
            if (!locationInput) return;

            gpsBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            locationInput.placeholder = "Detecting your position...";

            if (!navigator.geolocation) {
                alert("Geolocation is not supported by your browser.");
                gpsBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async function(position) {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                        const data = await response.json();
                        
                        const address = data.address;
                        const placeName = address.suburb || address.town || address.city || address.village || "Unknown Location";
                        const country = address.country || "";
                        
                        locationInput.value = country ? `${placeName}, ${country}` : placeName;
                    } catch (error) {
                        locationInput.value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
                    }
                    gpsBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
                    locationInput.placeholder = "City, Country or Coordinates";
                },
                function(error) {
                    alert("Unable to retrieve location. Please check your browser's location permissions.");
                    gpsBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
                    locationInput.placeholder = "City, Country or Coordinates";
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        });
    }

    const locForm = document.getElementById('locationForm');
    if (locForm) {
        locForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const inputField = document.getElementById('locationInput') || document.getElementById('location');
            const displayEl = document.getElementById('savedLocationDisplay');
            if (!inputField) return;

            const inputVal = inputField.value.trim();
            
            if (inputVal) {
                if (displayEl) displayEl.textContent = inputVal;
                
                let user = JSON.parse(localStorage.getItem('app_user')) || {};
                user.saved_location = inputVal;
                localStorage.setItem('app_user', JSON.stringify(user));

                if (displayEl) {
                    displayEl.style.color = '#2dd4bf'; 
                    setTimeout(() => {
                        displayEl.style.color = 'var(--text-main)';
                    }, 1000);
                }
                
                inputField.value = '';
                alert("Work location successfully updated!");
            }
        });
    }

    // I. Intercept Form Submission to bridge UI Loader and Core Engine
    const verificationForm = document.getElementById('verificationForm');
    if (verificationForm) {
        verificationForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const loadingText = document.getElementById('loadingText');
            const viewDetailsLink = document.getElementById('viewDetailsLink');
            
            if (loadingText) loadingText.style.display = 'block';
            if (viewDetailsLink) viewDetailsLink.style.visibility = 'hidden';

            if (typeof handleVerify === "function") {
                await handleVerify(e);
            }
            
            if (loadingText) loadingText.style.display = 'none';
        });
    }

    // J. Context Calendar Elements Generation Routing
    const pillBtn = document.getElementById('datePickerPillBtn');
    const dropdownPanel = document.getElementById('calendarDropdownPanel');
    const gridCells = document.getElementById('calendarGridCellsContainer');
    const monthSelect = document.getElementById('calMonthSelect');
    const yearSelect = document.getElementById('calYearSelect');
    const labelRange = document.getElementById('dateRangeValueLabel');

    if (yearSelect) {
        yearSelect.innerHTML = '';
        const currentSystemYear = new Date().getFullYear(); 
        for (let y = 2016; y <= 2030; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === currentSystemYear) opt.selected = true;
            yearSelect.appendChild(opt);
        }
    }

    if (pillBtn && dropdownPanel) {
        pillBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownPanel.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            dropdownPanel.classList.remove('show');
        });

        dropdownPanel.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    function populateCells() {
        if (!gridCells) return;
        gridCells.innerHTML = '';
        
        const year = parseInt(yearSelect.value);
        const month = parseInt(monthSelect.value);
        
        const totalDays = new Date(year, month + 1, 0).getDate();
        const startOffset = new Date(year, month, 1).getDay();

        for (let s = 0; s < startOffset; s++) {
            gridCells.innerHTML += `<div style="background:transparent; pointer-events:none;"></div>`;
        }

        for (let i = 1; i <= totalDays; i++) {
            let classes = 'calendar-grid-cell';
            if (month === 10 && year === 2020 && i === 29) {
                classes += ' active-range';
            }
            gridCells.innerHTML += `<div class="${classes}" data-day="${i}">${i}</div>`;
        }

        document.querySelectorAll('.calendar-grid-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const selectedDay = e.target.getAttribute('data-day');
                const monthName = monthSelect.options[monthSelect.selectedIndex].text.substring(0, 3);
                if (labelRange) {
                    labelRange.textContent = `${monthName} 1, ${year} - ${monthName} ${selectedDay}, ${year}`;
                }
                dropdownPanel.classList.remove('show');
            });
        });
    }

    if (monthSelect && yearSelect) {
        monthSelect.addEventListener('change', populateCells);
        yearSelect.addEventListener('change', populateCells);
        populateCells();
    }
});

// =========================================================================
// 10. About Page 
// =========================================================================
    
        const menuBtn = document.getElementById('menuBtn');
        const sidebarDrawer = document.getElementById('sidebarDrawer');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        const dropdownTrigger = document.getElementById('dropdownTrigger');
        const profileDropdown = document.getElementById('profileDropdown');

        // Drawer Menu Open/Close Toggles
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebarDrawer.classList.toggle('open');
            sidebarOverlay.classList.toggle('show');
        });

        // Click on background overlay to close drawer
        sidebarOverlay.addEventListener('click', () => {
            sidebarDrawer.classList.remove('open');
            sidebarOverlay.classList.remove('show');
        });

        // Dropdown Menu Toggles targeted via the dropdown arrow indicator specifically
        dropdownTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault(); // Stop anchor navigate logic on arrow click
            profileDropdown.classList.toggle('show');
        });

        // Global layout events to dismiss menus instantly on out-clicks
        document.addEventListener('click', (e) => {
            if (!sidebarDrawer.contains(e.target) && e.target !== menuBtn) {
                sidebarDrawer.classList.remove('open');
                sidebarOverlay.classList.remove('show');
            }
            if (!dropdownTrigger.contains(e.target) && !profileDropdown.contains(e.target)) {
                profileDropdown.classList.remove('show');
            }
        });
  
// Example: Run this when the user saves their profile
function saveProfileData(name, profilePicUrl, role) {
    // 1. Save to localStorage so other pages can see it
    localStorage.setItem("username", name);
    localStorage.setItem("userAvatar", profilePicUrl);
    localStorage.setItem("userRole", role); // e.g., "Admin Panel" or "User Panel"

    alert("Profile updated successfully!");
}     
document.addEventListener("DOMContentLoaded", () => {
    // 1. Fetch saved details from localStorage
    const savedName = localStorage.getItem("username");
    const savedAvatar = localStorage.getItem("userAvatar");
    const savedRole = localStorage.getItem("userRole");

    // 2. Find the header elements by their IDs
    const nameElement = document.getElementById("topUserNavName");
    const avatarElement = document.getElementById("topUserNavAvatar");
    const roleElement = document.getElementById("topUserNavRole");

    // 3. If saved data exists, update the header dynamically
    if (savedName && nameElement) {
        nameElement.textContent = savedName;
    }
    
    if (savedAvatar && avatarElement) {
        avatarElement.src = savedAvatar;
    }

    if (savedRole && roleElement) {
        roleElement.textContent = savedRole;
    }
});

const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('fileInput');
        const loader = document.getElementById('loader');
        const laser = document.getElementById('laser');
        const resultCard = document.getElementById('resultCard');
        const fileNameDisplay = document.getElementById('fileNameDisplay');
        const resetBtn = document.getElementById('resetBtn');
        const scanCounter = document.getElementById('scanCounter');
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const sidebarOverlay = document.getElementById('sidebarOverlay');

        let remainingScans = 5;

        // Mobile Sidebar Toggle
        hamburgerBtn.addEventListener('click', () => {
            sidebarOverlay.classList.add('show');
        });

        sidebarOverlay.addEventListener('click', (e) => {
            if (e.target === sidebarOverlay) {
                sidebarOverlay.classList.remove('show');
            }
        });

        // Interactive Scan Workflow Processing Logic
        fileInput.addEventListener('change', function(e) {
            if (this.files && this.files[0]) {
                if (remainingScans <= 0) {
                    alert("You have exhausted your 5 monthly trial document scans. Please upgrade to enterprise access.");
                    return;
                }
                processMockScan(this.files[0].name);
            }
        });

        function processMockScan(fileName) {
            dropzone.style.display = 'none';
            loader.style.display = 'flex';
            laser.style.display = 'block';

            // Simulate the optical scanning delay process
            setTimeout(() => {
                loader.style.display = 'none';
                laser.style.display = 'none';
                
                // Show output report module
                fileNameDisplay.textContent = fileName;
                resultCard.style.display = 'block';
                
                // --- DYNAMIC PERCENTAGE & VALIDATION LOGIC ---
                // 1. Generate a random score between 40 and 99
                const dynamicPercentage = Math.floor(Math.random() * (99 - 40 + 1)) + 40;
                
                // 2. Target the UI elements inside the result card
                const percentElement = document.getElementById('confidenceDisplay');
                const statusBadge = document.getElementById('statusBadge');
                const verdictText = document.getElementById('verdictText');

                // 3. Update the values, colors, and text based on thresholds
                percentElement.textContent = dynamicPercentage + '%';
                
                if (dynamicPercentage < 60) {
                    // RED STATE - FAKE
                    percentElement.style.color = '#ef4444'; 
                    statusBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                    statusBadge.style.color = '#ef4444';
                    statusBadge.style.borderColor = '#ef4444';
                    statusBadge.textContent = 'Verification Failed';
                    verdictText.innerHTML = '<strong>Verdict:</strong> <span style="color: #ef4444; font-weight: bold;">FAKE / TAMPERED</span>. Document elements appear altered or fail structural verification parameters.';
                    
                } else if (dynamicPercentage < 80) {
                    // BLUE STATE - SUSPICIOUS
                    percentElement.style.color = '#3b82f6';
                    statusBadge.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                    statusBadge.style.color = '#3b82f6';
                    statusBadge.style.borderColor = '#3b82f6';
                    statusBadge.textContent = 'Suspicious Record';
                    verdictText.innerHTML = '<strong>Verdict:</strong> <span style="color: #3b82f6; font-weight: bold;">INCOMPLETE / UNVERIFIED</span>. Missing metadata fields or low-resolution formatting detected.';
                    
                } else {
                    // GREEN STATE - GENUINE
                    percentElement.style.color = '#10b981';
                    statusBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                    statusBadge.style.color = '#10b981';
                    statusBadge.style.borderColor = '#10b981';
                    statusBadge.textContent = 'Verified Genuine';
                    verdictText.innerHTML = '<strong>Verdict:</strong> <span style="color: #10b981; font-weight: bold;">GENUINE CLEARANCE</span>. Cryptographic matches confirmed. Secure record verification complete.';
                }
                
                // Track usage parameters
                remainingScans--;
                scanCounter.textContent = remainingScans;
            }, 3000);
        }

        resetBtn.addEventListener('click', () => {
            resultCard.style.display = 'none';
            fileInput.value = '';
            dropzone.style.display = 'flex';
        });

   document.getElementById('logForm').addEventListener('submit', function(event) {
    event.preventDefault(); 
    
    // Capture user selections from the form inputs
    const selectedEmail = document.getElementById('email').value;
    const selectedRole = document.getElementById('role').value;
    
    // Store them in the browser's temporary memory bank
    localStorage.setItem('userEmail', selectedEmail);
    localStorage.setItem('userRole', selectedRole);
    
    // Redirect to the dashboard page
    window.location.href = "dashboard.html"; 
});

