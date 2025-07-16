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


    // Get frame and rows for dialing
    console.log('Looking for prospects...');
    let frameHandle, frame;
    
    try {
      frameHandle = await page.waitForSelector('#iframeRuntime', { timeout: 10000 });
      frame = await frameHandle.contentFrame();
      
      await frame.waitForSelector('tr.k-master-row', { timeout: 10000 });
      const rows = await frame.$$('tr.k-master-row');
      
      console.log(`Found ${rows.length} rows. Searching for selected statuses...`);
      let currentStatusIndex = 0;
      let found = false;
      let attemptCount = 0; // Track attempts for current prospect
      const maxAttempts = 3; // Maximum attempts per prospect
      
      for (let rowIdx = 0; rowIdx < rows.length && currentStatusIndex < statusesToDial.length; rowIdx++) {
        const row = rows[rowIdx];
        const cells = await row.$$('td');
        
        if (cells.length > 9) {
          const status = (await cells[9].innerText()).trim();
          
 if (status === statusesToDial[currentStatusIndex]) {
            const name = (await cells[1].innerText()).trim();
            const phone = (await cells[6].innerText()).trim();
            // Reset attempt count for new prospect
            if (attemptCount === 0) {
              console.log(`\nFound: ${name} - ${phone} (${status})`);
            }
            
            attemptCount++;
            console.log(`\n📞 ATTEMPT ${attemptCount}/${maxAttempts}: ${name} - ${phone}`);
            
            // HIGHLIGHT the contact being dialed
            await frame.evaluate(idx => {
              const row = document.querySelectorAll('tr.k-master-row')[idx];
              if (row) {
                row.style.background = '#ffeb3b'; // Bright yellow highlight
                row.style.border = '3px solid #ff5722'; // Orange border
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, rowIdx);

            // Copy phone number to clipboard
            await rcPage.evaluate((phoneNumber) => {
              navigator.clipboard.writeText(phoneNumber).catch(() => {
                const textArea = document.createElement('textarea');
                textArea.value = phoneNumber;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
              });
            }, phone);

         console.log(`📞 DIALING: ${name} - ${phone}`);
            console.log(`📋 Phone number copied to clipboard`);
            console.log('🎯 Contact highlighted - switching to RingCentral...');
            
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
              await phoneInput.press('Control+v'); // Paste from clipboard
              await rcPage.waitForTimeout(500);
              
              console.log(`✅ Phone number ${phone} pasted successfully!`);
              console.log('☎️ Ready to call - press the green call button when ready');
            } else {
              console.log('❌ Could not find phone input field');
              console.log('📋 Phone number is in clipboard - paste manually with Ctrl+V');
            }
            
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
//Here after the call is initiated, we handle the keypress for muting and detecting prospect answer
             await rcPage.waitForTimeout(2000); // Wait for call interface to load
            
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

let hangUpEarly = false;
let prospectAnswered = false;

 // Setup keypress detection for this call
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.setEncoding('utf8');

            for (let timeLeft = 33; timeLeft > 0; timeLeft--) {
              process.stdout.write(`\rCall time: ${timeLeft}s (Press [S] if answered, [SPACE] to hang up) `);
              
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
              
              if (keyPressed === 's' || keyPressed === 'S') {
                prospectAnswered = true;
                attemptCount = 0; // Reset attempt counter when prospect answers
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
            process.stdin.setRawMode(false);

            // Only auto-hangup if prospect didn't answer
            if (!prospectAnswered) {
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
            } else {
              console.log('\n📞 Call ended by user - continuing to next contact...');
            }
            
            // Pause before next contact
            await rcPage.waitForTimeout(1000);
            // Determine next action based on call result
            if (prospectAnswered) {
              console.log('\n✅ Prospect answered - moving to next contact...\n');
              attemptCount = 0; // Reset for next prospect
              currentStatusIndex++;
              found = true;
            } else {
              // No answer - check if we should retry
              if (attemptCount < maxAttempts) {
                console.log(`\n🔄 No answer - preparing for attempt ${attemptCount + 1}/${maxAttempts}...`);
                console.log('📋 Re-pasting phone number and redialing...\n');
                
                // Re-paste phone number and redial
                await rcPage.bringToFront();
                await rcPage.waitForTimeout(1000);
                
                // Find phone input and clear it
                let phoneInput;
                const inputSelectors = [
                  'input[placeholder*="name or number"]',
                  'input[placeholder*="Enter a name"]',
                  '.phone-input input',
                  'input[type="text"]',
                  '.dialpad input'
                ];
                
                for (const selector of inputSelectors) {
                  try {
                    phoneInput = await rcPage.$(selector);
                    if (phoneInput) break;
                  } catch (e) {
                    continue;
                  }
                }
                
                if (phoneInput) {
                  await phoneInput.click();
                  await phoneInput.selectText(); // Select all text
                  await phoneInput.press('Control+v'); // Paste phone number again
                  await rcPage.waitForTimeout(500);
                  
                  // Auto-redial immediately (no countdown for retries)
                  console.log('📞 Auto-redialing...');
                  try {
                    await phoneInput.press('Enter');
                    console.log('📞 Redial initiated!');
                  } catch {
                    console.log('❌ Could not auto-redial, please press call button manually');
                  }
                  
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
                  
                  // Enhanced call timer with mute and answer detection for retry
                  console.log('⏱️  Call timer started - 33 seconds');
                  console.log('🔇 Microphone should be muted');
                  console.log('Press [S] if prospect ANSWERS (will unmute & stop timer)');
                  console.log('Press [SPACE] to hang up early, or wait for auto-hangup');

                  let hangUpEarly = false;
                  let prospectAnswered = false;

                  // Setup keypress detection for this retry call
                  process.stdin.setRawMode(true);
                  process.stdin.resume();
                  process.stdin.setEncoding('utf8');

                  for (let timeLeft = 33; timeLeft > 0; timeLeft--) {
                    process.stdout.write(`\rCall time: ${timeLeft}s (Press [S] if answered, [SPACE] to hang up) `);
                    
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
                    
                    if (keyPressed === 's' || keyPressed === 'S') {
                      prospectAnswered = true;
                      attemptCount = 0; // Reset attempt counter when prospect answers
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

                  // Cleanup keypress listeners for retry
                  process.stdin.setRawMode(false);

                  // Handle hangup for retry call
                  if (!prospectAnswered) {
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
                  }
                  
                  // If prospect answered during retry, break out of retry loop
                  if (prospectAnswered) {
                    attemptCount = 0;
                    currentStatusIndex++;
                    found = true;
                    break;
                  }
                  
                  // Continue the loop to handle this retry attempt
                  rowIdx--; // Stay on same row for retry
                  continue; // Go back to call handling
                } else {
                  console.log('❌ Could not find phone input for redial');
                  attemptCount = 0; // Reset and move to next
                  currentStatusIndex++;
                  found = true;
                }
              } else {
                console.log(`\n❌ No answer after ${maxAttempts} attempts - moving to next contact...\n`);
                attemptCount = 0; // Reset for next prospect
                currentStatusIndex++;
                found = true;
              }
            }
            
            if (currentStatusIndex >= statusesToDial.length) {
              console.log('\nAll selected statuses have been dialed!');
              break;
            }
          }
        }
      }

      if (!found) {
        console.log(`No prospects found with selected statuses.`);
      } else if (currentStatusIndex < statusesToDial.length) {
        console.log(`\nDialed ${currentStatusIndex} out of ${statusesToDial.length} selected prospects.`);
      }

    } catch (error) {
      console.log('Error finding prospects:', error.message);
    }

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
          