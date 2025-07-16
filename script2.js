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
              await phoneInput.selectText(); // Clear existing content
              await phoneInput.press('Control+v'); // Paste from clipboard
              await rcPage.waitForTimeout(500);
              
              console.log(`✅ Phone number ${phone} pasted successfully!`);
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
          
          found = true;
          break; // Break out of row loop to find next prospect
        }
      }
    }
    
    if (!prospectFound) {
      console.log(`\n🔄 No more contacts with status: ${statusesToDial[currentStatusIndex]}`);
      currentStatusIndex++; // Move to next status
      
      if (currentStatusIndex >= statusesToDial.length) {
        console.log('\n🎉 All selected statuses completed! Returning to status selection...\n');
        
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
        
        // Return to status selection
        currentStatusIndex = 0;
        found = false;
        
        // Recreate status selection loop
        console.log('\n=== STATUS SELECTOR ===');
        selectedStatuses.clear(); // Clear previous selections
        
        let selecting = true;
        while (selecting) {
          displayStatusMenu();
          
          const choice = prompt('\nEnter your choice: ').trim();
          const choiceNum = parseInt(choice);
          
          if (choice === '0') {
            if (selectedStatuses.size > 0) {
              selecting = false;
              console.log('\nStarting to dial selected statuses...');
              
              // Rebuild statusesToDial array
              statusesToDial.length = 0; // Clear array
              selectedStatuses.forEach((count, status) => {
                for (let i = 0; i < count; i++) {
                  statusesToDial.push(status);
                }
              });
              
              console.log(`\nWill dial ${statusesToDial.length} prospects from ${selectedStatuses.size} different statuses.`);
              currentStatusIndex = 0; // Reset to start over
              
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
        break; // Exit the main dialing loop to restart
      }
    }
  }

  if (!found) {
    console.log(`No prospects found with selected statuses.`);
  }

} catch (error) {
  console.log('Error finding prospects:', error.message);
}