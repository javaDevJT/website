// ASCII Art utilities for various commands

export const cowsay = (message: string): string => {
  const messageLength = message.length;
  const border = '-'.repeat(messageLength + 2);
  
  return `
 ${border}
< ${message} >
 ${border}
        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||
`;
};

export const neofetch = (clientInfo: any, serverInfo: any): string => {
  // If we have server info, show REAL server data!
  if (serverInfo) {
    const osName = serverInfo.os?.name || 'Unknown OS';
    const osVersion = serverInfo.os?.version || '';
    const osArch = serverInfo.os?.arch || '';
    const cpuCores = serverInfo.cpu?.cores || serverInfo.os?.availableProcessors || 'Unknown';
    const cpuLoad = serverInfo.cpu?.systemCpuLoad ? ` (Load: ${serverInfo.cpu.systemCpuLoad.toFixed(1)}%)` : '';
    
    // Memory formatting
    const totalMemoryGB = serverInfo.memory?.totalPhysical ? 
      (serverInfo.memory.totalPhysical / (1024 * 1024 * 1024)).toFixed(1) : 
      (serverInfo.memory?.heapMax / (1024 * 1024 * 1024)).toFixed(1);
    const usedMemoryGB = serverInfo.memory?.usedPhysical ? 
      (serverInfo.memory.usedPhysical / (1024 * 1024 * 1024)).toFixed(1) :
      (serverInfo.memory?.heapUsed / (1024 * 1024 * 1024)).toFixed(1);
    
    // Runtime info
    const javaVersion = serverInfo.runtime?.javaVersion || 'Unknown';
    const vmName = serverInfo.runtime?.vmName || 'JVM';
    const hostname = serverInfo.hostname || 'server';
    const uptimeMs = serverInfo.uptime || 0;
    const uptime = formatServerUptime(uptimeMs);
    
    return `
                   -\`                    ${clientInfo?.username || 'visitor'}@${hostname}
                  .o+\`                   ────────────────────────────────
                 \`ooo/                   OS: ${osName} ${osVersion}
                \`+oooo:                  Host: ${vmName}
               \`+oooooo:                 Kernel: Java ${javaVersion}
               -+oooooo+:                Uptime: ${uptime}
             \`/:-:++oooo+:               Shell: jterminal v1.0
            \`/++++/+++++++:              Architecture: ${osArch}
           \`/++++++++++++++:             Terminal: CustomTerminalEnhanced
          \`/+++ooooooooooooo/\`           CPU: ${cpuCores} cores${cpuLoad}
         ./ooosssso++osssssso+\`          Memory: ${usedMemoryGB}GB / ${totalMemoryGB}GB
        .oossssso-\`\`\`\`/ossssss+\`         Client IP: ${clientInfo?.ipAddress || 'Unknown'}
       -osssssso.      :ssssssso.        ${getColorBar()}
      :osssssss/        osssso+++.       
     /ossssssss/        +ssssooo/-       
   \`/ossssso+/:-        -:/+osssso+-     
  \`+sso+:-\`                 \`.-/+oso:    
 \`++:.                           \`-/+/   
 .\`                                 \`/   
`;
  }
  
  // Fallback to client-side detection if no server info
  const userAgent = clientInfo?.userAgent || navigator.userAgent;
  const browser = getBrowserInfo(userAgent);
  const os = getOSInfo(userAgent);
  const memory = getMemoryInfo();
  const startTime = performance.timeOrigin;
  const uptime = getDetailedUptime(startTime);
  
  return `
                   -\`                    ${clientInfo?.username || 'visitor'}@${clientInfo?.hostname || 'javadevjt.tech'}
                  .o+\`                   ────────────────────────────────
                 \`ooo/                   OS: ${os} (Client)
                \`+oooo:                  Host: ${browser}
               \`+oooooo:                 Kernel: React 19.2.0
               -+oooooo+:                Uptime: ${uptime}
             \`/:-:++oooo+:               Shell: jterminal v1.0
            \`/++++/+++++++:              Resolution: ${window.innerWidth}x${window.innerHeight}
           \`/++++++++++++++:             Terminal: CustomTerminalEnhanced
          \`/+++ooooooooooooo/\`           CPU: ${navigator.hardwareConcurrency || 'Unknown'} cores
         ./ooosssso++osssssso+\`          Memory: ${memory}
        .oossssso-\`\`\`\`/ossssss+\`         IP: ${clientInfo?.ipAddress || 'Unknown'}
       -osssssso.      :ssssssso.        ${getColorBar()}
      :osssssss/        osssso+++.       
     /ossssssss/        +ssssooo/-       
   \`/ossssso+/:-        -:/+osssso+-     
  \`+sso+:-\`                 \`.-/+oso:    
 \`++:.                           \`-/+/   
 .\`                                 \`/   
`;
};

const getBrowserInfo = (userAgent: string): string => {
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    const match = userAgent.match(/Chrome\/([0-9.]+)/);
    return match ? `Chrome ${match[1].split('.')[0]}` : 'Chrome';
  }
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    const match = userAgent.match(/Version\/([0-9.]+)/);
    return match ? `Safari ${match[1].split('.')[0]}` : 'Safari';
  }
  if (userAgent.includes('Firefox')) {
    const match = userAgent.match(/Firefox\/([0-9.]+)/);
    return match ? `Firefox ${match[1].split('.')[0]}` : 'Firefox';
  }
  if (userAgent.includes('Edg')) {
    const match = userAgent.match(/Edg\/([0-9.]+)/);
    return match ? `Edge ${match[1].split('.')[0]}` : 'Edge';
  }
  return 'Unknown Browser';
};

const getOSInfo = (userAgent: string): string => {
  if (userAgent.includes('Mac OS X')) {
    const match = userAgent.match(/Mac OS X ([0-9_]+)/);
    if (match) {
      const version = match[1].replace(/_/g, '.');
      return `macOS ${version}`;
    }
    return 'macOS';
  }
  if (userAgent.includes('Windows NT')) {
    const match = userAgent.match(/Windows NT ([0-9.]+)/);
    if (match) {
      const version = match[1];
      if (version === '10.0') return 'Windows 10/11';
      if (version === '6.3') return 'Windows 8.1';
      if (version === '6.2') return 'Windows 8';
      if (version === '6.1') return 'Windows 7';
      return `Windows NT ${version}`;
    }
    return 'Windows';
  }
  if (userAgent.includes('Android')) {
    const match = userAgent.match(/Android ([0-9.]+)/);
    return match ? `Android ${match[1]}` : 'Android';
  }
  if (userAgent.includes('Linux')) return 'Linux x86_64';
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    const match = userAgent.match(/OS ([0-9_]+)/);
    if (match) {
      const version = match[1].replace(/_/g, '.');
      return `iOS ${version}`;
    }
    return 'iOS';
  }
  return navigator.platform || 'Unknown OS';
};

const getMemoryInfo = (): string => {
  // @ts-ignore - navigator.deviceMemory is experimental
  const memory = navigator.deviceMemory;
  if (memory) {
    return `${memory}GB`;
  }
  // Estimate based on CPU cores
  if (navigator.hardwareConcurrency) {
    const cores = navigator.hardwareConcurrency;
    const estimatedGB = cores >= 8 ? 16 : cores >= 4 ? 8 : 4;
    return `~${estimatedGB}GB`;
  }
  return '8GB';
};

const getDetailedUptime = (startTime: number): string => {
  const uptime = Date.now() - startTime;
  const seconds = Math.floor(uptime / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

const formatServerUptime = (uptimeMs: number): string => {
  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};



const getColorBar = (): string => {
  return '   ████ ████ ████ ████ ████ ████ ████ ████';
};

export const carAscii = (): string => {
  return `

                     *************###%*+#**===                
                ***+==-::*******#%#***###*##**#**+=-=         
           %**++**::::::**#++#%#=+#%##%#+=*#******#------     
      #***+===****++****#%%%*++**%=%%@@@%%****+===+=----=====*
 ++++++*******************===+====+##===+++**#*****###*******#
+===+*************+===-=++******#*+*******************#####***
#*************###********%%%@@@@@%******************+*%%%%%*++
%#**********************%%@@%%%%@@%*********#*****+*+%%%%%%%**
*###*******************#%%@%%%%%%%@#***************#%%%%%%%%%%
%%%%%%%##%%%%%%%%%%%%%%@%@%%%@@@@%%%####%#%%%####%%%@%@%%%%*  
%%%%%%%##%%%%%%%%%%@%%%%@@%@%%%%@%%%%%%%%%@@%@@@@@@@@@@@%%%   
%%%%@%@@@@@@@@@@@@@@@@@@@@@%%@%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 
  %%@@@@@@@@@@@@@@@@@@@@@@@%%%%%%@@@@@@@@@@@@@@@@@@@@@        
 @@@@@@@@@@@@@@@@@@@@@@@@@@@@%%@@@@@@@@@@@@@@                 
          @@@@@@@@@@@@@@@@@@@@@@@@@                                                                       
                
        My Dream Car: Tesla Cybertruck
        
        ┌─────────────────────────────────────┐
        │ Powertrain:    3 Electric Motors    │
        │ Power:     845 HP (combined)        │
        │ 0-60 mph:  2.6 seconds              │
        │ Drivetrain: AWD                     │
        └─────────────────────────────────────┘
`;
};

export const diagnosticsAscii = (): string => {
  return `
╔══════════════════════════════════════════════════════════╗
║           SYSTEM DIAGNOSTICS - OBD-II SCAN               ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  [✓] Engine Control Module        OK    (12.4V)          ║
║  [✓] Transmission Control          OK    (Optimal)       ║
║  [✓] ABS System                    OK    (All sensors)   ║
║  [✓] Airbag System                 OK    (Ready)         ║
║  [✓] Emission Control              OK    (Cat: 98%)      ║
║  [✓] Fuel System                   OK    (Pressure: 58)  ║
║  [✓] Ignition System               OK    (Spark: Good)   ║
║  [✓] Cooling System                OK    (Temp: 195°F)   ║
║                                                          ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ Engine RPM:    [████████░░] 3,400 RPM              │  ║
║  │ Vehicle Speed: [█████░░░░░] 45 MPH                 │  ║
║  │ Coolant Temp:  [███████░░░] 195°F                  │  ║
║  │ Fuel Level:    [██████████] 95%                    │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                          ║
║  Diagnostic Trouble Codes: None                          ║
║  Last Service: 2,500 miles ago                           ║
║  Next Service Due: 7,500 miles                           ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

All systems operational. You're good to go! 🏁
`;
};

export const vtecAscii = (): string => {
  return `
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║  ██╗   ██╗████████╗███████╗ ██████╗                      ║
║  ██║   ██║╚══██╔══╝██╔════╝██╔════╝                      ║
║  ██║   ██║   ██║   █████╗  ██║                           ║
║  ╚██╗ ██╔╝   ██║   ██╔══╝  ██║                           ║
║   ╚████╔╝    ██║   ███████╗╚██████╗                      ║
║    ╚═══╝     ╚═╝   ╚══════╝ ╚═════╝                      ║
║                                                          ║
║           JUST KICKED IN, YO! 🏎️💨                       ║
║                                                          ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ RPM: ████████████████████ 6,000+ RPM               │  ║
║  │ POWER: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ MAX PERFORMANCE          │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                          ║
║  Variable Valve Timing & Lift Electronic Control         ║
║  Switching to high-performance cam profile...            ║
║  BWAAAAHHHHHHH! 🎵                                       ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`;
};

export const matrixRain = (): string => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const width = 80;
  const height = 20;
  let result = '';
  
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      if (Math.random() > 0.7) {
        result += chars[Math.floor(Math.random() * chars.length)];
      } else {
        result += ' ';
      }
    }
    result += '\n';
  }
  
  return result;
};

export const hackingAnimation = (): string => {
  return `
[████████████████████████] 100%

INITIATING HACK SEQUENCE...

> Connecting to mainframe...
> Bypassing firewall...
> Cracking encryption...
> Accessing secure database...
> Downloading files...
> Covering tracks...

╔══════════════════════════════════════╗
║  HACK COMPLETE!                      ║
║  Files Downloaded: 1,337             ║
║  Security Level: BREACHED            ║
║  Detection Risk: 0%                  ║
╚══════════════════════════════════════╝

Just kidding! You're on a portfolio site. 😄
Type 'help' to see what you can actually do here.
`;
};

export const coffeeBreak = (): string => {
  return `
       (  )   (   )  )
        ) (   )  (  (
        ( )  (    ) )
        _____________
       <_____________> ___
       |             |/ _ \\
       |               | | |
       |               |_| |
    ___|             |\\___/
   /    \\___________/    \\
   \\_____________________/

   ☕ Coffee Break Activated ☕
   
   Taking a moment to recharge...
   Just like this terminal, developers
   need fuel to run efficiently!
   
   Fun fact: Coffee breaks improve
   productivity and code quality.
   
   Type 'help' when you're ready to
   continue exploring! ☕
`;
};

export const konamiCode = (): string => {
  return `
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   ██╗  ██╗ ██████╗ ███╗   ██╗ █████╗ ███╗   ███╗██╗      ║
║   ██║ ██╔╝██╔═══██╗████╗  ██║██╔══██╗████╗ ████║██║      ║
║   █████╔╝ ██║   ██║██╔██╗ ██║███████║██╔████╔██║██║      ║
║   ██╔═██╗ ██║   ██║██║╚██╗██║██╔══██║██║╚██╔╝██║██║      ║
║   ██║  ██╗╚██████╔╝██║ ╚████║██║  ██║██║ ╚═╝ ██║██║      ║
║   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝      ║
║                                                          ║
║              🎮 KONAMI CODE ACTIVATED! 🎮                ║
║                                                          ║
║            You've unlocked: TURBO MODE                   ║
║                                                          ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ • All typing animations now run at MAXIMUM SPEED   │  ║
║  │ • Secret commands revealed                         │  ║
║  │ • Easter egg master achievement unlocked           │  ║
║  │ • +30 Nostalgia Points                             │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                          ║
║  You clearly know your gaming history! 👾                ║
║  Type 'secrets' to see what else you've unlocked!        ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`;
};
