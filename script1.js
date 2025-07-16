const { chromium } = require('playwright');
const prompt = require('prompt-sync')();
const path = require('path');

// Try to load environment variables, but don't crash if .env doesn't exist
try {
  require('dotenv').config();
} catch (e) {
  console.log('No .env file found, using hardcoded credentials');
}

// CONFIGURATION SECTION
const LOGIN_EMAIL = process.env.LOGIN_EMAIL || 'lparada@federaltaxlawgroup.com';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'FTLG1208681!!';
const USER_DATA_DIR = './playwright-profile';
console.log('=== CREDENTIAL CHECK ===');
console.log('LOGIN_EMAIL loaded:', LOGIN_EMAIL ? 'YES' : 'NO');
console.log('LOGIN_PASSWORD loaded:', LOGIN_PASSWORD ? 'YES' : 'NO');
if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
  console.log('Warning: Credentials not loaded from .env file');
  console.log('Make sure .env file exists in the same folder as script1.js');
}

// AUTO LOGIN FUNCTION
// AUTO LOGIN FUNCTION - FIXED WITH EXACT SELECTORS
async function loginToIRSLogics(page, email, password) {
  console.log('Attempting automatic login...');
  
  try {
    await page.waitForTimeout(2000);
    
    // Use the exact IDs from your screenshots
    const emailSelectors = [
      '#txtUsername2',           // Exact ID from screenshot
      'input[id="txtUsername2"]',
      'input[name="txtUsername2"]'
    ];
    
    const passwordSelectors = [
      '#txtPassword2',           // Exact ID from screenshot  
      'input[id="txtPassword2"]',
      'input[name="txtPassword2"]'
    ];
    
    // Fill email field
    let emailFilled = false;
    for (const selector of emailSelectors) {
      try {
        const emailField = await page.$(selector);
        if (emailField) {
          await emailField.click(); // Click to focus
          await emailField.fill(''); // Clear field
          await emailField.fill(email);
          console.log(`Email filled with selector: ${selector}`);
          emailFilled = true;
          break;
        }
      } catch (e) {
        console.log(`Email selector failed: ${selector}`);
        continue;
      }
    }
    
    // Fill password field
    let passwordFilled = false;
    for (const selector of passwordSelectors) {
      try {
        const passwordField = await page.$(selector);
        if (passwordField) {
          await passwordField.click(); // Click to focus
          await passwordField.fill(''); // Clear field
          await passwordField.fill(password);
          console.log(`Password filled with selector: ${selector}`);
          passwordFilled = true;
          break;
        }
      } catch (e) {
        console.log(`Password selector failed: ${selector}`);
        continue;
      }
    }
    
    if (emailFilled && passwordFilled) {
      // Click the "Log in" button - try multiple selectors
      const loginSelectors = [
        'input[value="Log in"]',     // Based on screenshot
        'button:has-text("Log in")',
        'input[type="submit"]',
        '#btnLogin',
        '.btn-primary'
      ];
      
      let loginClicked = false;
      for (const selector of loginSelectors) {
        try {
          const loginButton = await page.$(selector);
          if (loginButton) {
            await loginButton.click();
            console.log(`Login button clicked with selector: ${selector}`);
            loginClicked = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      // Fallback: press Enter on password field
      if (!loginClicked) {
        try {
          await page.press('#txtPassword2', 'Enter');
          console.log('Pressed Enter on password field');
          loginClicked = true;
        } catch (e) {
          console.log('Could not press Enter on password field');
        }
      }
      
      return loginClicked;
      
    } else {
      console.log(`Login failed - Email filled: ${emailFilled}, Password filled: ${passwordFilled}`);
      return false;
    }
    
  } catch (error) {
    console.log('Login automation error:', error.message);
    return false;
  }
}
// MAIN SCRIPT
(async () => {
  let browserContext;
  let page;
  let rcPage;
  
  try {
    console.log('Starting browser...');
    
    // SECTION 1: BROWSER SETUP
browserContext = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: false,
  viewport: null,
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor'
  ]
});

    // SECTION 2: GET PAGES
    const pages = browserContext.pages();
    
    if (pages.length >= 2) {
      page = pages[0];
      rcPage = pages[1];
    } else {
      page = await browserContext.newPage();
      rcPage = await browserContext.newPage();
    }

    // SECTION 3: LOAD WEBSITES
    console.log('Loading IRSLogics...');
    await page.goto('https://ftlg.irslogics.com/Default.aspx#', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    console.log('Loading RingCentral...');
    await rcPage.goto('https://app.ringcentral.com', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Wait for pages to load
    console.log('Waiting for pages to load...');
    await page.waitForTimeout(5000);
    await rcPage.waitForTimeout(3000);

    // SECTION 4: DEBUG PAGE STATUS
    console.log('\n=== CHECKING PAGE STATUS ===');
    
    const title = await page.title();
    const url = await page.url();
    console.log(`Page title: ${title}`);
    console.log(`Page URL: ${url}`);
    


    // SECTION 5: CHECK LOGIN STATUS
    let needsIRSLogin = false;
    
    try {
      await page.waitForSelector('input[type="password"]', { timeout: 3000 });
      needsIRSLogin = true;
      console.log('Login required - found password field');
    } catch {
      console.log('No password field found - might be logged in');
    }
    
    if (!needsIRSLogin && title.toLowerCase().includes('login')) {
      needsIRSLogin = true;
      console.log('Login required - title contains login');
    }

    // SECTION 6: HANDLE LOGIN
    if (needsIRSLogin) {
      console.log('\n=== LOGIN REQUIRED ===');
      
      // Try automatic login
      const loginSuccess = await loginToIRSLogics(page, LOGIN_EMAIL, LOGIN_PASSWORD);
      
      if (loginSuccess) {
        console.log('Login submitted, waiting...');
        await page.waitForTimeout(5000);
        
        // Check for second login
        try {
          await page.waitForSelector('input[type="password"]', { timeout: 3000 });
          console.log('Second login needed...');
          await loginToIRSLogics(page, LOGIN_EMAIL, LOGIN_PASSWORD);
          await page.waitForTimeout(3000);
        } catch {
          console.log('Second login not needed');
        }
        
        // Check for MFA
        try {
          await page.waitForSelector('input[placeholder*="code"], input[name*="mfa"]', { timeout: 3000 });
          console.log('MFA required - please enter manually');
          await page.bringToFront();
          prompt('Enter MFA code and press Enter here when done...');
        } catch {
          console.log('No MFA required');
        }
        
      } else {
        console.log('\nAutomatic login failed. Manual login required:');
        console.log(`Email: ${LOGIN_EMAIL}`);
        console.log(`Password: ${LOGIN_PASSWORD}`);
        console.log('\nPlease login manually in the browser window');
        
        await page.bringToFront();
        prompt('Press Enter after logging in...');
      }
    } else {
      console.log('Already logged in or no login required');
    }

    // SECTION 7: CHECK RINGCENTRAL
    let needsRCLogin = false;
    try {
      await rcPage.waitForSelector('input[type="password"], [data-sign="loginButton"]', { timeout: 3000 });
      needsRCLogin = true;
      console.log('RingCentral login required');
    } catch {
      console.log('RingCentral already logged in');
    }

    if (needsRCLogin) {
      await rcPage.bringToFront();
      prompt('Please login to RingCentral and press Enter...');
    }

    // SECTION 8: SAVE SESSIONS
if (needsIRSLogin || needsRCLogin) {
  console.log('Sessions will be saved automatically for next time!');
}
    // SECTION 9: NAVIGATION
    console.log('\n=== AUTOMATED NAVIGATION ===');
await page.bringToFront();
await page.waitForTimeout(2000);

try {
  // Click on Cases in the left sidebar
  console.log('Clicking on Cases...');
  const casesSelectors = [
    'text=Cases',
    '[title="Cases"]',
    'a:has-text("Cases")',
    'span:has-text("Cases")',
    '#Cases',
    '.cases'
  ];
  
  let casesClicked = false;
  for (const selector of casesSelectors) {
    try {
      const casesElement = await page.$(selector);
      if (casesElement) {
        await casesElement.click();
        console.log(`Cases clicked with selector: ${selector}`);
        casesClicked = true;
        await page.waitForTimeout(1500);
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  if (!casesClicked) {
    console.log('Could not click Cases automatically');
    prompt('Please click Cases manually and press Enter...');
  }
  
  // Now click on FD 2 PROSPECTS (it should be visible after clicking Cases)
  console.log('Looking for FD 2 PROSPECTS...');
  const fd2Selectors = [
    'text=FD 2 PROSPECTS',
    'a:has-text("FD 2 PROSPECTS")',
    '[title="FD 2 PROSPECTS"]',
    'span:has-text("FD 2 PROSPECTS")'
  ];
  
  let fd2Clicked = false;
  for (const selector of fd2Selectors) {
    try {
      const fd2Element = await page.$(selector);
      if (fd2Element) {
        await fd2Element.click();
        console.log(`FD 2 PROSPECTS clicked with selector: ${selector}`);
        fd2Clicked = true;
        await page.waitForTimeout(3000);
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  if (!fd2Clicked) {
    console.log('Could not click FD 2 PROSPECTS automatically');
    prompt('Please click FD 2 PROSPECTS manually and press Enter...');
  }
  
  console.log('Navigation completed! Looking for prospects table...');
  
} catch (error) {
  console.log('Navigation error:', error.message);
  prompt('Please navigate manually to FD 2 PROSPECTS and press Enter...');
}

console.log('Navigation completed! Now sorting by Status...');

// Wait for the iframe to load and sort by Status
try {
  console.log('Looking for iframe...');
  const frameHandle = await page.waitForSelector('#iframeRuntime', { timeout: 10000 });
  const frame = await frameHandle.contentFrame();
  
  console.log('Waiting for prospects table to load...');
  await frame.waitForSelector('tr[role="row"]', { timeout: 10000 });
  
  // Click on Status column header to sort
  console.log('Clicking Status column to sort...');
  const statusSelectors = [
    'a[data-field="Status"]',           // From your screenshot
    'th[data-field="Status"] a',        // More specific
    '.k-link[data-field="Status"]',     // Using the k-link class
    'a.k-link:has-text("Status")',      // Backup selector
    'th:has-text("Status") a'           // Another backup
  ];
  
  let statusSorted = false;
  for (const selector of statusSelectors) {
    try {
      const statusHeader = await frame.$(selector);
      if (statusHeader) {
        await statusHeader.click();
        console.log(`Status column clicked with selector: ${selector}`);
        statusSorted = true;
        await frame.waitForTimeout(2000); // Wait for sort to complete
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  if (!statusSorted) {
    console.log('Could not sort by Status automatically');
    prompt('Please click the Status column header to sort, then press Enter...');
  } else {
    console.log('Table sorted by Status successfully!');
  }
  
} catch (error) {
  console.log('Error setting up table:', error.message);
  prompt('Please make sure you are on FD 2 PROSPECTS page and press Enter...');
}

    // SECTION 10: PROSPECT DIALING
    // SECTION 10: INTERACTIVE STATUS SELECTOR
while (true) {
console.log('\n=== STATUS SELECTOR ===');

const availableStatuses = [
  '[Active Prospect]-1st Day of Attempted Contact',
  '[Active Prospect]-2nd Day of Attempted Contact', 
  '[Active Prospect]-3rd Day of Attempted Contact',
  '[Active Prospect]-4th Day of Attempted Contact',
  '[Active Prospect]-OPENERS',
  '[Active Prospect]-Reschedule Appointment',
  '[Active Prospect]-Working'
];

const selectedStatuses = new Map(); // Track selected statuses and counts

function displayStatusMenu() {
  console.log('\n=== SELECT STATUSES TO DIAL ===');
  console.log('Enter the number to toggle a status (adds *1, *2, etc.)');
  console.log('Enter 0 when done selecting\n');
  
  availableStatuses.forEach((status, index) => {
    const count = selectedStatuses.get(status) || 0;
    const countDisplay = count > 0 ? ` *${count}` : '';
    console.log(`${index + 1}. ${status}${countDisplay}`);
  });
  
  if (selectedStatuses.size > 0) {
    console.log('\n--- SELECTED STATUSES ---');
    selectedStatuses.forEach((count, status) => {
      console.log(`${status} *${count}`);
    });
  }
  
  console.log('\n0. Start dialing selected statuses');
  console.log('99. Clear all selections');
}

// Status selection loop
let selecting = true;
while (selecting) {
  displayStatusMenu();
  
  const choice = prompt('\nEnter your choice: ').trim();
  const choiceNum = parseInt(choice);
  
  if (choice === '0') {
    if (selectedStatuses.size > 0) {
      selecting = false;
      console.log('\nStarting to dial selected statuses...');
    } else {
      console.log('\nNo statuses selected! Please select at least one.');
    }
  } else if (choice === '99') {
    selectedStatuses.clear();
    console.log('\nAll selections cleared.');
  } else if (choiceNum >= 1 && choiceNum <= availableStatuses.length) {
    const selectedStatus = availableStatuses[choiceNum - 1];
    const currentCount = selectedStatuses.get(selectedStatus) || 0;
    selectedStatuses.set(selectedStatus, currentCount + 1);
    console.log(`\nAdded: ${selectedStatus} *${currentCount + 1}`);
  } else {
    console.log('\nInvalid choice. Please try again.');
  }
}

// Convert selected statuses to array for dialing
const statusesToDial = [];
selectedStatuses.forEach((count, status) => {
  for (let i = 0; i < count; i++) {
    statusesToDial.push(status);
  }
});

console.log(`\nWill dial ${statusesToDial.length} prospects from ${selectedStatuses.size} different statuses.`);


    // FIXED DIALING SECTION - Replace the entire dialing logic with this

// Get frame and rows for dialing
console.log('Looking for prospects...');
let frameHandle, frame;

try {
  frameHandle = await page.waitForSelector('#iframeRuntime', { timeout: 10000 });
  frame = await frameHandle.contentFrame();
  
  await frame.waitForSelector('tr.k-master-row', { timeout: 10000 });
  
  console.log('Starting dialing process...');
  let currentStatusIndex = 0;
  let found = false;
  const maxAttempts = 3; // Maximum attempts per prospect
  
  // Add event listener cleanup function
  process.stdin.setMaxListeners(20); // Increase limit to prevent warnings
  
  while (currentStatusIndex < statusesToDial.length) {
    console.log(`\nSearching for prospects with status: ${statusesToDial[currentStatusIndex]}`);
    
    // Get fresh row data
    const rows = await frame.$$('tr.k-master-row');
    console.log(`Found ${rows.length} rows total`);
    
    let prospectFound = false;
    
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
  const row = rows[rowIdx];
  const cells = await row.$$('td');
  
  if (cells.length > 9) {
    const status = (await cells[9].innerText()).trim();
    
    if (status === statusesToDial[currentStatusIndex]) {
      const name = (await cells[1].innerText()).trim();
      const phone = (await cells[6].innerText()).trim();
      
      console.log(`\nFound prospect: ${name} - ${phone} (${status})`);
      prospectFound = true;
      
      // Dial this prospect up to 3 times
      let attemptCount = 0;
      let prospectAnswered = false;
      let shouldSkip = false;
      
      while (attemptCount < maxAttempts && !prospectAnswered && !shouldSkip) {
        attemptCount++;
        console.log(`\n📞 ATTEMPT ${attemptCount}/${maxAttempts}: ${name} - ${phone}`);
        
        // IMPORTANT: Get fresh contact info for each attempt
        const currentRow = rows[rowIdx];
        const currentCells = await currentRow.$$('td');
        const currentName = (await currentCells[1].innerText()).trim();
        const currentPhone = (await currentCells[6].innerText()).trim();
        
        // Switch to IRS Logics tab to highlight contact
        await page.bringToFront();
        await page.waitForTimeout(500);
        
        // CLEAR previous highlights and HIGHLIGHT current contact
        await frame.evaluate(idx => {
          // Clear all previous highlights
          const allRows = document.querySelectorAll('tr.k-master-row');
          allRows.forEach(row => {
            row.style.background = '';
            row.style.border = '';
          });
          
          // Highlight current row
          const currentRow = allRows[idx];
          if (currentRow) {
            currentRow.style.background = '#ffeb3b'; // Bright yellow highlight
            currentRow.style.border = '3px solid #ff5722'; // Orange border
            currentRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, rowIdx);

        // Copy phone number to clipboard - USE CURRENT PHONE
        await rcPage.evaluate((phoneNumber) => {
          navigator.clipboard.writeText(phoneNumber).catch(() => {
            const textArea = document.createElement('textarea');
            textArea.value = phoneNumber;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
          });
        }, currentPhone); // Use currentPhone instead of phone

        console.log(`📞 DIALING: ${currentName} - ${currentPhone}`);
        console.log(`📋 Phone number copied to clipboard`);
        console.log('🎯 Contact highlighted - switching to RingCentral...');
        
        // Continue with rest of dialing logic...
        // [Keep all the RingCentral dialing code the same]

            // Switch back to RingCentral tab
            await rcPage.bringToFront();
            await rcPage.waitForTimeout(1000);
            
            // Find the phone input field and paste
            console.log('🔍 Looking for phone input field...');
            const inputSelectors = [
              'input[placeholder*="name or number"]',
              'input[placeholder*="Enter a name"]',
              '.phone-input input',
              'input[type="text"]',
              '.dialpad input'
            ];
            
            let phoneInput;
            for (const selector of inputSelectors) {
              try {
                phoneInput = await rcPage.$(selector);
                if (phoneInput) {
                  console.log(`📱 Found input field with selector: ${selector}`);
                  break;
                }
              } catch (e) {
                continue;
              }
            }
            
            if (phoneInput) {
              // Clear field and paste phone number
              await phoneInput.click();
              await phoneInput.selectText(); // Clear existing content
              await phoneInput.press('Control+v'); // Paste from clipboard
              await rcPage.waitForTimeout(500);
              
              console.log(`✅ Phone number ${currentPhone} pasted successfully!`);
              console.log('☎️ Ready to call - press the green call button when ready');
            } else {
              console.log('❌ Could not find phone input field');
              console.log('📋 Phone number is in clipboard - paste manually with Ctrl+V');
            }
            
            // Auto-call logic
            if (attemptCount === 1) {
              console.log('📞 Press ENTER to call, or wait 3 seconds for auto-call...');
              
              // 3 second countdown to press Enter or auto-call
              let callInitiated = false;
              for (let i = 3; i > 0; i--) {
                process.stdout.write(`\rAuto-call in ${i}s... (Press ENTER to call now) `);
                
                // Check if Enter was pressed
                await new Promise(resolve => {
                  const timeout = setTimeout(resolve, 1000);
                  process.stdin.once('data', () => {
                    clearTimeout(timeout);
                    callInitiated = true;
                    console.log('\n📞 Call initiated manually!');
                    resolve();
                  });
                });
                
                if (callInitiated) break;
              }
              
              if (!callInitiated) {
                // Auto-press Enter/Call button
                try {
                  await phoneInput.press('Enter');
                  console.log('\n📞 Auto-call initiated!');
                } catch {
                  console.log('\n📞 Could not auto-call, please press call button manually');
                }
              }
            } else {
              // For retries, auto-dial immediately
              console.log('📞 Auto-redialing...');
              try {
                await phoneInput.press('Enter');
                console.log('📞 Redial initiated!');
              } catch {
                console.log('❌ Could not auto-redial, please press call button manually');
              }
            }

            // Wait for call interface to load
            await rcPage.waitForTimeout(2000);
            
            console.log('🔇 Attempting to mute microphone...');
            const muteSelectors = [
              'button[aria-label*="Mute"]',
              'button[title*="Mute"]',
              'button[data-sign="muteButton"]',
              '.mute-button',
              'button[aria-label*="mute"]',
              '[data-testid="mute-button"]',
              'button:has-text("Mute")'
            ];
            
            let micMuted = false;
            for (const selector of muteSelectors) {
              try {
                const muteButton = await rcPage.$(selector);
                if (muteButton) {
                  await muteButton.click();
                  console.log(`🔇 Microphone muted with selector: ${selector}`);
                  micMuted = true;
                  break;
                }
              } catch (e) {
                continue;
              }
            }
            
            if (!micMuted) {
              console.log('❌ Could not auto-mute microphone - please mute manually');
            }

            // Enhanced call timer with mute and answer detection
            console.log('⏱️  Call timer started - 33 seconds');
            console.log('🔇 Microphone should be muted');
            console.log('Press [S] if prospect ANSWERS (will unmute & stop timer)');
            console.log('Press [SPACE] to hang up early, or wait for auto-hangup');
            console.log('Press [K] to skip to next prospect');

            let hangUpEarly = false;
            let callAnswered = false;
            let skipPressed = false;

            // Setup keypress detection for this call
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.setEncoding('utf8');

            for (let timeLeft = 33; timeLeft > 0; timeLeft--) {
              process.stdout.write(`\rCall time: ${timeLeft}s (Press [S] if answered, [SPACE] to hang up, [K] to skip) `);
              
              // Check for keypress with 1 second timeout
              const keyPressed = await new Promise(resolve => {
                const timeout = setTimeout(() => resolve(null), 1000);
                
                const keyListener = (key) => {
                  clearTimeout(timeout);
                  process.stdin.removeListener('data', keyListener);
                  resolve(key.toString());
                };
                
                process.stdin.once('data', keyListener);
              });
              
               if (keyPressed === 'k' || keyPressed === 'K') {
                console.log('\n⏭️ SKIPPING CONTACT - Moving to next prospect...');
                skipPressed = true;
                shouldSkip = true;
                
                // Find next contact with same status immediately
                let nextContactFound = false;
                for (let nextRowIdx = rowIdx + 1; nextRowIdx < rows.length; nextRowIdx++) {
                  const nextRow = rows[nextRowIdx];
                  const nextCells = await nextRow.$$('td');
                  
                  if (nextCells.length > 9) {
                    const nextStatus = (await nextCells[9].innerText()).trim();
                    
                    if (nextStatus === statusesToDial[currentStatusIndex]) {
                      const nextName = (await nextCells[1].innerText()).trim();
                      const nextPhone = (await nextCells[6].innerText()).trim();
                      console.log(`✅ Found next contact to skip to: ${nextName} - ${nextPhone}`);
                      
                      // This will be handled after hangup
                      nextContactFound = true;
                      break;
                    }
                  }
                }
                
                if (!nextContactFound) {
                  console.log(`\n🔄 No more contacts with status: ${statusesToDial[currentStatusIndex]} - will move to next status`);
                }
                
                break;
              } else if (keyPressed === 's' || keyPressed === 'S') {
                callAnswered = true;
                prospectAnswered = true;
                console.log('\n📞 PROSPECT ANSWERED! Unmuting and stopping timer...');
                
                // Try to unmute
                const unmuteSelectors = [
                  'button[aria-label*="Unmute"]',
                  'button[title*="Unmute"]',
                  'button[aria-label*="unmute"]',
                  '.unmute-button',
                  ...muteSelectors // Try the same selectors (toggle)
                ];
                
                let unmuted = false;
                for (const selector of unmuteSelectors) {
                  try {
                    const unmuteButton = await rcPage.$(selector);
                    if (unmuteButton) {
                      await unmuteButton.click();
                      console.log(`🔊 Microphone unmuted with selector: ${selector}`);
                      unmuted = true;
                      break;
                    }
                  } catch (e) {
                    continue;
                  }
                }
                
                if (!unmuted) {
                  console.log('❌ Could not auto-unmute - please unmute manually');
                }
                
                console.log('✅ Call continues - prospect answered!');
                console.log('Press [CTRL+S] when ready to continue to next contact...');
                
                // Wait for Ctrl+S combination
                await new Promise(resolve => {
                  const ctrlSListener = (key) => {
                    // Check for Ctrl+S (key code 19)
                    if (key.charCodeAt(0) === 19) {
                      console.log('\n➡️ Continuing to next contact...');
                      process.stdin.removeListener('data', ctrlSListener);
                      resolve();
                    }
                  };
                  process.stdin.on('data', ctrlSListener);
                });
                
                break;
              } else if (keyPressed === ' ') {
                hangUpEarly = true;
                console.log(`\n🔴 Hanging up early... (Attempt ${attemptCount}/${maxAttempts})`);
                break;
              }
            }

            // Cleanup keypress listeners
            try {
              process.stdin.setRawMode(false);
              process.stdin.removeAllListeners('data');
            } catch (e) {
              // Ignore cleanup errors
            }

            // Handle hangup
            if (!callAnswered && !skipPressed) {
              // Auto-hangup after 33 seconds or manual hangup
              try {
                const hangupSelectors = [
                  'button[aria-label*="Hang up"]',
                  'button[title*="Hang up"]', 
                  '.hangup-button',
                  'button[aria-label*="End call"]',
                  '.end-call-button'
                ];
                
                let hungUp = false;
                for (const selector of hangupSelectors) {
                  try {
                    const hangupButton = await rcPage.$(selector);
                    if (hangupButton) {
                      await hangupButton.click();
                      console.log(`\n🔴 Call ended with selector: ${selector}`);
                      hungUp = true;
                      break;
                    }
                  } catch (e) {
                    continue;
                  }
                }
                
                if (!hungUp) {
                  if (hangUpEarly) {
                    console.log('\n🔴 Manual hangup requested - please click hang up button');
                  } else {
                    console.log('\n🔴 33 seconds completed - please click hang up button manually');
                  }
                }
                
              } catch (error) {
                console.log('\n🔴 Could not auto-hangup:', error.message);
              }
            } else if (skipPressed) {
              // Handle skip hangup
              try {
                const hangupSelectors = [
                  'button[aria-label*="Hang up"]',
                  'button[title*="Hang up"]', 
                  '.hangup-button',
                  'button[aria-label*="End call"]',
                  '.end-call-button'
                ];
                
                for (const selector of hangupSelectors) {
                  try {
                    const hangupButton = await rcPage.$(selector);
                    if (hangupButton) {
                      await hangupButton.click();
                      console.log(`🔴 Call ended for skip`);
                      break;
                    }
                  } catch (e) {
                    continue;
                  }
                }
              } catch (error) {
                console.log('Could not auto-hangup for skip');
              }
            }
            
            // Pause before next attempt/contact
            await rcPage.waitForTimeout(1000);
            
            // If prospect answered or skip pressed, break the attempt loop
            if (prospectAnswered || shouldSkip) {
              break;
            }
          }
          
         
// After finishing all attempts for this prospect
if (prospectAnswered) {
  console.log('\n✅ Prospect answered - moving to next contact...\n');
} else if (shouldSkip) {
  console.log('\n⏭️ Contact skipped - moving to next contact...\n');
} else {
  console.log(`\n❌ No answer after ${maxAttempts} attempts - moving to next contact...\n`);
}

// Continue to next row automatically - the for loop will handle this
        }
      }
    }
    
    if (!prospectFound) {
      console.log(`\n🔄 No more contacts with status: ${statusesToDial[currentStatusIndex]}`);
      currentStatusIndex++; // Move to next status
      
      if (currentStatusIndex >= statusesToDial.length) {
  console.log('\n🎉 All selected statuses completed!\n');
  
  // Switch back to IRS Logics to highlight table
  await page.bringToFront();
  await page.waitForTimeout(1000);
  
  // Clear all highlights
  await frame.evaluate(() => {
    const allRows = document.querySelectorAll('tr.k-master-row');
    allRows.forEach(row => {
      row.style.background = '';
      row.style.border = '';
    });
  });
  
  // Reset for next selection
  currentStatusIndex = 0;
  found = false;
  selectedStatuses.clear(); // Clear previous selections
  statusesToDial.length = 0; // Clear the dialing array
  
  // Continue the main loop - this will go back to status selection
  break;
}
    }
  }

  if (!found) {
    console.log(`No prospects found with selected statuses.`);
  }

} catch (error) {
  console.log('Error finding prospects:', error.message);
}

} // End of main dialing loop
  } catch (error) {
    console.log('Script error:', error.message);
  } finally {
    // CLEANUP
    console.log('\nPress Enter to close...');
    prompt();
    if (browserContext) {
      await browserContext.close();
    }
  }
})();
          