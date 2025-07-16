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
      
      for (let rowIdx = 0; rowIdx < rows.length && currentStatusIndex < statusesToDial.length; rowIdx++) {
        const row = rows[rowIdx];
        const cells = await row.$$('td');
        
        if (cells.length > 9) {
          const status = (await cells[9].innerText()).trim();
          
          if (status === statusesToDial[currentStatusIndex]) {
            // Highlight row
            await frame.evaluate(idx => {
              const row = document.querySelectorAll('tr.k-master-row')[idx];
              if (row) row.style.background = '#yellow';
            }, rowIdx);

            const name = (await cells[1].innerText()).trim();
            const phone = (await cells[6].innerText()).trim();
            console.log(`\nFound: ${name} - ${phone} (${status})`);

            // DIALING
            console.log('Switching to RingCentral...');
            await rcPage.bringToFront();
            await rcPage.waitForTimeout(1000);
            
            try {
              const phoneInput = await rcPage.waitForSelector('input[placeholder*="name or number"]', { timeout: 5000 });
              await phoneInput.click({ clickCount: 3 });
              await phoneInput.fill(phone);
              await rcPage.waitForTimeout(500);
              
              try {
                await rcPage.click('button[aria-label*="Call"]', { timeout: 3000 });
                console.log('Call button clicked');
              } catch {
                await phoneInput.press('Enter');
                console.log('Enter pressed');
              }
              
              console.log(`Calling ${phone}... Press SPACE to stop`);
              for (let i = 30; i > 0; i--) {
                process.stdout.write(`\rTime: ${i}s `);
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
              console.log('\nCall completed');
              
            } catch (error) {
              console.log('Dialing error:', error.message);
            }

            found = true;
            currentStatusIndex++; // Move to next status in queue
            
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
          