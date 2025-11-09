import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import TypingText from './TypingText';
import { TypingSpeed } from '../hooks/useTypingEffect';
import * as asciiArt from '../utils/asciiArt';

const CONTACT_EMAIL = 'joshterk@javadevjt.tech';
const CONTACT_LINKEDIN = 'https://www.linkedin.com/in/joshuaterk/';
const CONTACT_INFO = `Contact Information:

Email: ${CONTACT_EMAIL}
LinkedIn: ${CONTACT_LINKEDIN}`;

interface CommandOutput {
  command: string;
  output: string;
  type?: 'success' | 'error' | 'info';
}

const CustomTerminalEnhanced: React.FC = () => {
  const [currentPath, setCurrentPath] = useState('/home/visitor');
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<CommandOutput[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [hostname, setHostname] = useState('javadevjt.tech');
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [turboMode, setTurboMode] = useState(false);
  const [secretsUnlocked, setSecretsUnlocked] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  // File system structure - will be loaded dynamically
  const [fileSystem, setFileSystem] = useState<any>({
    '/home/visitor': {
      type: 'directory',
      contents: {
        'portfolio': { type: 'directory', contents: {} },
        'blog': { type: 'directory', contents: {} },
        'about.txt': { type: 'file' },
        'contact.txt': { type: 'file' },
        'resume.txt': { type: 'file' }
      }
    }
  });

  const unlockSecret = (secret: string) => {
    if (!secretsUnlocked.includes(secret)) {
      setSecretsUnlocked(prev => [...prev, secret]);
    }
  };

  const commands: any = {
    help: `Available commands:

NAVIGATION:
  cd <dir>    - Change directory
  ls          - List directory contents
  ll          - Long list directory contents
  pwd         - Print working directory
  tree        - Visual directory tree

FILE OPERATIONS:
  cat <file>  - Display file contents
  ./<file>    - Execute file
  grep <text> - Search within files
  find <name> - Find files by name

INFORMATION:
  whoami      - Display user info
  uname       - System information
  date        - Current date/time
  neofetch    - System info with ASCII art
  history     - Show command history
  man <cmd>   - Manual for command

COMMUNICATION:
  contact     - Show contact information

FUN STUFF:
  banner      - Display ASCII art banner
  cowsay <msg> - ASCII art message
  matrix      - Matrix effect
  coffee      - Take a coffee break
  clear       - Clear terminal
  
AUTOMOTIVE:
  car         - Show dream car
  diagnostics - System diagnostics
  vtec        - You know what this does...
  
TYPE 'secrets' TO SEE DISCOVERED EASTER EGGS`,

    whoami: () => clientInfo ? `${clientInfo.username}@${hostname} (${clientInfo.ipAddress})` : 'visitor@javadevjt.tech',
    
    pwd: () => currentPath,
    
    uname: () => `WebTerminal 1.0.0 (Joshua Terk Portfolio)
Architecture: x64
Platform: ${navigator.platform}
User Agent: ${navigator.userAgent}`,

    date: () => new Date().toString(),

    neofetch: async () => {
      try {
        const serverResponse = await axios.get('/api/server/info');
        return asciiArt.neofetch(clientInfo, serverResponse.data);
      } catch (error) {
        console.error('Error fetching server info:', error);
        return asciiArt.neofetch(clientInfo, null);
      }
    },

    cowsay: (message: string) => {
      if (!message) return 'Usage: cowsay <message>';
      return asciiArt.cowsay(message);
    },

    car: () => {
      unlockSecret('automotive_enthusiast');
      return asciiArt.carAscii();
    },

    diagnostics: () => {
      unlockSecret('mechanic');
      return asciiArt.diagnosticsAscii();
    },

    vtec: () => {
      unlockSecret('vtec_kicked_in');
      return asciiArt.vtecAscii();
    },

    gm: () => {
      unlockSecret('gm_employee');
      return `
╔════════════════════════════════════════════════════════════╗
║                   GENERAL MOTORS                           ║
║              Excellence Through Innovation                 ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Current Role: SRE Team Lead                               ║
║  Division: In-Vehicle Product Cybersecurity                ║
║                                                            ║
║  Working on:                                               ║
║  • In-vehicle cryptographic systems                        ║
║  • Manufacturing plant security                            ║
║  • Vehicle authentication protocols                        ║
║  • High-performance distributed systems                    ║
║                                                            ║
║  "Building the secure future of automotive technology"     ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`;
    },

    konami: () => {
      unlockSecret('konami_code');
      setTurboMode(true);
      return asciiArt.konamiCode();
    },

    hack: () => {
      unlockSecret('hacker');
      return asciiArt.hackingAnimation();
    },

    turbo: () => {
      setTurboMode(!turboMode);
      return `Turbo Mode ${!turboMode ? 'ENABLED' : 'DISABLED'}! ${!turboMode ? '⚡🏎️💨' : '🐌'}`;
    },

    coffee: () => {
      unlockSecret('coffee_break');
      return asciiArt.coffeeBreak();
    },

    sudo: (_args: string) => {
      unlockSecret('tried_sudo');
      return `[sudo] password for ${clientInfo?.username || 'visitor'}:
Nice try! 😄 But this is a portfolio site, not a real terminal.
You don't have sudo access here (and wouldn't want it anyway!)

Pro tip: Try 'secrets' to see what easter eggs you've found!`;
    },

    secrets: () => {
      if (secretsUnlocked.length === 0) {
        return `No secrets discovered yet! Keep exploring...
Try some commands you might not expect to work. 😉`;
      }

      const secretDescriptions: Record<string, string> = {
        'konami_code': '🎮 Konami Code Master',
        'automotive_enthusiast': '🏎️ Automotive Enthusiast',
        'gearhead': '🔧 Gearhead',
        'mechanic': '🛠️ Mechanic',
        'vtec_kicked_in': '⚡ VTEC Activated',
        'gm_employee': '🏭 GM Insider',
        'hacker': '💻 Hacker (Nice Try)',
        'tried_sudo': '🔒 Sudo Attempt',
        'coffee_break': '☕ Coffee Lover',
      };

      let output = '╔════════════════════════════════════════╗\n';
      output += '║      DISCOVERED EASTER EGGS            ║\n';
      output += '╠════════════════════════════════════════╣\n';
      secretsUnlocked.forEach(secret => {
        output += `║ ${secretDescriptions[secret] || secret}\n`;
      });
      output += '╚════════════════════════════════════════╝\n';
      output += `\nProgress: ${secretsUnlocked.length}/9 secrets discovered`;
      
      return output;
    },

    history: () => {
      if (commandHistory.length === 0) {
        return 'No command history';
      }
      return commandHistory.map((cmd, i) => `  ${i + 1}  ${cmd}`).join('\n');
    },

    tree: () => {
      const buildTree = (path: string, prefix: string = ''): string => {
        const parts = path.split('/').filter(p => p);
        let dirStructure = fileSystem;
        
        for (let i = 0; i < parts.length; i++) {
          if (i === 0 && parts[i] === 'home') continue;
          if (i === 1 && parts[i] === 'visitor') {
            dirStructure = dirStructure['/home/visitor'];
            continue;
          }
          if (dirStructure && dirStructure.contents && dirStructure.contents[parts[i]]) {
            dirStructure = dirStructure.contents[parts[i]];
          }
        }

        if (!dirStructure || !dirStructure.contents) {
          return '';
        }

        const items = Object.keys(dirStructure.contents);
        let output = '';
        
        items.forEach((item, index) => {
          const isLastItem = index === items.length - 1;
          const connector = isLastItem ? '└── ' : '├── ';
          const entry = dirStructure.contents[item];
          
          if (entry.type === 'directory') {
            output += `${prefix}${connector}${item}/\n`;
          } else if (entry.type === 'executable') {
            output += `${prefix}${connector}${item}*\n`;
          } else {
            output += `${prefix}${connector}${item}\n`;
          }
        });

        return output;
      };

      return `${currentPath}/\n${buildTree(currentPath)}`;
    },

    man: (commandName: string) => {
      if (!commandName) {
        return 'Usage: man <command>\nTry: man help';
      }

      const manPages: Record<string, string> = {
        help: 'HELP(1)\n\nNAME\n    help - display available commands\n\nSYNOPSIS\n    help\n\nDESCRIPTION\n    Displays a list of all available terminal commands.',
        ls: 'LS(1)\n\nNAME\n    ls - list directory contents\n\nSYNOPSIS\n    ls\n\nDESCRIPTION\n    Lists files and directories in the current directory.',
        cd: 'CD(1)\n\nNAME\n    cd - change directory\n\nSYNOPSIS\n    cd <directory>\n\nDESCRIPTION\n    Changes the current directory to the specified path.',
        cat: 'CAT(1)\n\nNAME\n    cat - concatenate and display file contents\n\nSYNOPSIS\n    cat <filename>\n\nDESCRIPTION\n    Displays the contents of the specified file.',
        cowsay: 'COWSAY(1)\n\nNAME\n    cowsay - ASCII art speaking cow\n\nSYNOPSIS\n    cowsay <message>\n\nDESCRIPTION\n    Generates an ASCII art cow saying your message.',
      };

      return manPages[commandName.toLowerCase()] || `No manual entry for ${commandName}\nTry 'help' for available commands.`;
    },

    find: (filename: string) => {
      if (!filename) {
        return 'Usage: find <filename>';
      }

      const searchFiles = (dir: any, path: string = '/home/visitor'): string[] => {
        const results: string[] = [];
        if (!dir || !dir.contents) return results;

        Object.keys(dir.contents).forEach(key => {
          const entry = dir.contents[key];
          if (key.toLowerCase().includes(filename.toLowerCase())) {
            results.push(`${path}/${key}`);
          }
          if (entry.type === 'directory') {
            results.push(...searchFiles(entry, `${path}/${key}`));
          }
        });

        return results;
      };

      const results = searchFiles(fileSystem['/home/visitor']);
      return results.length > 0 ? results.join('\n') : `find: '${filename}': No such file or directory`;
    },

    grep: (searchTerm: string) => {
      if (!searchTerm) {
        return 'Usage: grep <search term>';
      }

      const currentDir = getCurrentDirectory();
      if (!currentDir || !currentDir.contents) {
        return 'grep: cannot access current directory';
      }

      const results: string[] = [];
      Object.keys(currentDir.contents).forEach(key => {
        if (key.toLowerCase().includes(searchTerm.toLowerCase())) {
          results.push(`${key}: matched`);
        }
      });

      return results.length > 0 ? results.join('\n') : `grep: no matches found for '${searchTerm}'`;
    },

    cd: (directory: string) => {
      let newPath = currentPath;

      if (directory === '..') {
        const pathParts = currentPath.split('/').filter(p => p);
        if (pathParts.length > 2) {
          pathParts.pop();
          newPath = '/' + pathParts.join('/');
        }
      } else if (directory === '~' || directory === '') {
        newPath = `/home/${clientInfo?.username || 'visitor'}`;
      } else if (directory.startsWith('/')) {
        newPath = directory;
      } else {
        if (currentPath === `/home/${clientInfo?.username || 'visitor'}`) {
          newPath = `${currentPath}/${directory}`;
        } else {
          return `cd: ${directory}: No such directory`;
        }
      }

      const currentDir = getCurrentDirectory();
      if (currentDir && currentDir.contents && currentDir.contents[directory] &&
          currentDir.contents[directory].type === 'directory') {
        setCurrentPath(newPath);
        return `Changed directory to ${newPath}`;
      } else if (newPath !== currentPath) {
        setCurrentPath(newPath);
        return `Changed directory to ${newPath}`;
      } else {
        return `cd: ${directory}: No such directory`;
      }
    },

    ls: () => {
      const currentDir = getCurrentDirectory();
      if (!currentDir || !currentDir.contents) {
        return 'ls: cannot access current directory';
      }

      const items = Object.keys(currentDir.contents);
      if (items.length === 0) {
        return '';
      }

      return items.map(item => {
        const entry = currentDir.contents[item];
        if (entry.type === 'directory') {
          return `${item}/`;
        } else if (entry.type === 'executable') {
          return `*${item}`;
        } else {
          return item;
        }
      }).join('\n');
    },

    ll: () => {
      const currentDir = getCurrentDirectory();
      if (!currentDir || !currentDir.contents) {
        return 'ls: cannot access current directory';
      }

      const items = Object.keys(currentDir.contents);
      if (items.length === 0) {
        return '';
      }

      const now = new Date();
      const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      };

      const lines = ['total ' + items.length];
      lines.push('drwxr-xr-x  2 visitor visitor  4096 ' + formatDate(now) + ' .');
      lines.push('drwxr-xr-x  3 visitor visitor  4096 ' + formatDate(now) + ' ..');

      items.forEach(item => {
        const entry = currentDir.contents[item];
        let permissions = '-rw-r--r--';
        let size = '1024';

        if (entry.type === 'directory') {
          permissions = 'drwxr-xr-x';
          size = '4096';
        } else if (entry.type === 'executable') {
          permissions = '-rwxr-xr-x';
          size = '2048';
        }

        lines.push(`${permissions}  1 visitor visitor ${size.padStart(6)} ${formatDate(now)} ${item}`);
      });

      return lines.join('\n');
    },

    cat: (filename: string) => {
      const currentDir = getCurrentDirectory();
      if (!currentDir || !currentDir.contents) {
        return `cat: ${filename}: No such file or directory`;
      }

      if (filename === 'about.txt') {
        return `About Joshua Terk:

I am a passionate backend engineer with expertise in building scalable, high-performance systems.
I currently work as the leader of an SRE team at General Motors, servicing in-vehicle cryptographic applications
vital to the day-to-day operation of our manufacturing plants and vehicles.

Key Expertise:
• Microservices Architecture & Design Patterns
• Performance Tuning & Optimization
• API Design & RESTful Services
• DevOps & Site Reliability Engineering
• System Security & Authentication
• Distributed Systems & Scalability
• Spring Boot & Java Ecosystem

With a strong foundation in computer science and years of experience in backend development,
I specialize in turning complex business requirements into efficient, maintainable code that
powers modern applications.`;
      } else if (filename === 'contact.txt') {
        return `${CONTACT_INFO}

Let's build something amazing.`;
      } else if (filename === 'resume.txt') {
        return `JOSHUA TERK
Backend Engineer & SRE Team Lead
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONTACT
  Email: joshterk@javadevjt.tech
  GitHub: github.com/javadevjt
  LinkedIn: linkedin.com/in/joshuaterk

EXPERIENCE
  General Motors | SRE Team Lead (Current)
  • Lead SRE team for in-vehicle cryptographic systems
  • Design and implement high-availability distributed systems
  • Ensure security and reliability of manufacturing operations
  • Performance optimization and incident response

SKILLS
  Backend: Java, Spring Boot, Microservices
  DevOps: Docker, Kubernetes, CI/CD
  Databases: PostgreSQL, Redis, H2
  Other: System Architecture, Security, Performance Tuning

Type 'cat about.txt' for more information!`;
      } else {
        return `cat: ${filename}: No such file`;
      }
    },

    banner: () => `
╔════════════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                            ║
║       ██╗ ██████╗ ███████╗██╗  ██╗██╗   ██╗ █████╗     ████████╗███████╗██████╗ ██╗  ██╗   ║
║       ██║██╔═══██╗██╔════╝██║  ██║██║   ██║██╔══██╗    ╚══██╔══╝██╔════╝██╔══██╗██║ ██╔╝   ║
║       ██║██║   ██║███████╗███████║██║   ██║███████║       ██║   █████╗  ██████╔╝█████╔╝    ║
║  ██   ██║██║   ██║╚════██║██╔══██║██║   ██║██╔══██║       ██║   ██╔══╝  ██╔══██╗██╔═██╗    ║
║  ╚█████╔╝╚██████╔╝███████║██║  ██║╚██████╔╝██║  ██║       ██║   ███████╗██║  ██║██║  ██╗   ║
║   ╚════╝  ╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝       ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ║
║                                                                                            ║
║              Backend Engineer & In-Vehicle Product Cybersecurity SRE Team Lead             ║
║                                       General Motors                                       ║
║                                                                                            ║
╚════════════════════════════════════════════════════════════════════════════════════════════╝
`,

    matrix: () => asciiArt.matrixRain() + '\n\nWake up, Neo...\nType \'clear\' to exit the matrix.',

    echo: (args: string) => args,

    clear: () => {
      setHistory([]);
      return '';
    },

    contact: () => `
╔════════════════════════════════════════════════════════════╗
║                     CONTACT DETAILS                        ║
╠════════════════════════════════════════════════════════════╣
║  Email: joshterk@javadevjt.tech                            ║
║  LinkedIn: https://www.linkedin.com/in/joshuaterk/         ║
╚════════════════════════════════════════════════════════════╝
`
  };

  const getCurrentDirectory = () => {
    const pathParts = currentPath.split('/').filter(p => p);
    let current = fileSystem['/home/visitor'];

    for (let i = 2; i < pathParts.length; i++) {
      if (current && current.contents && current.contents[pathParts[i]]) {
        current = current.contents[pathParts[i]];
      } else {
        return null;
      }
    }

    return current;
  };

  const getAutocompleteSuggestions = (input: string): string[] => {
    if (!input.trim()) {
      return Object.keys(commands).filter(cmd => typeof commands[cmd] !== 'function' || cmd !== 'clear');
    }

    // Special handling for ./ file execution
    if (input.startsWith('./')) {
      const partialFilename = input.substring(2);
      const currentDir = getCurrentDirectory();
      
      if (currentDir && currentDir.contents) {
        const items = Object.keys(currentDir.contents);
        return items
          .filter(item => item.toLowerCase().startsWith(partialFilename.toLowerCase()))
          .map(item => './' + item);
      }
      return [];
    }

    const parts = input.split(' ');
    const currentCmd = parts[0];

    if (parts.length === 1) {
      return Object.keys(commands).filter(cmd =>
        cmd.startsWith(currentCmd) && (typeof commands[cmd] !== 'function' || cmd !== 'clear')
      );
    }

    const args = parts.slice(1);
    const currentArg = args[args.length - 1] || '';
    const currentDir = getCurrentDirectory();

    if (currentDir && currentDir.contents) {
      const items = Object.keys(currentDir.contents);
      return items.filter(item => item.startsWith(currentArg));
    }

    return [];
  };

  const executeFile = async (filename: string): Promise<string> => {
    const currentDir = getCurrentDirectory();
    if (!currentDir || !currentDir.contents) {
      return `./${filename}: No such file or directory`;
    }

    const fileKey = Object.keys(currentDir.contents).find(key =>
      key.toLowerCase() === filename.toLowerCase()
    );

    if (!fileKey) {
      return `./${filename}: No such file or directory`;
    }

    const file = currentDir.contents[fileKey];
    if (!file || file.type !== 'executable') {
      return `./${filename}: Permission denied or not executable`;
    }

    let contentPath = '';
    if (currentPath === '/home/visitor/portfolio') {
      contentPath = `portfolio/${file.filename}`;
    } else if (currentPath === '/home/visitor/blog') {
      contentPath = `blog/${file.filename}`;
    } else {
      return `./${filename}: Cannot execute from this directory`;
    }

    try {
      const response = await axios.get(`/api/content/file?path=${contentPath}`);
      return response.data.content || 'Content not available';
    } catch (error: any) {
      console.error('Error loading content:', error);
      return `./${filename}: Error loading content - ${error.message}`;
    }
  };

  const executeCommand = async (cmd: string) => {
    const trimmedCmd = cmd.trim();
    if (!trimmedCmd) return;

    // Special handling for file execution (./ prefix)
    // Don't split by spaces to support filenames with spaces
    if (trimmedCmd.startsWith('./')) {
      const filename = trimmedCmd.substring(2);
      executeFile(filename).then((result: string) => {
        setHistory(prev => [...prev, { command: trimmedCmd, output: result }]);
        setCommandHistory(prev => [...prev, trimmedCmd]);
      }).catch((error: any) => {
        setHistory(prev => [...prev, { command: trimmedCmd, output: `Error: ${error.message}`, type: 'error' }]);
        setCommandHistory(prev => [...prev, trimmedCmd]);
      });
      return;
    }

    const [commandName, ...args] = trimmedCmd.split(' ');
    const commandKey = commandName.toLowerCase();

    let output = '';
    let outputType: 'success' | 'error' | 'info' = 'info';

    if (commandKey === 'clear') {
      commands.clear();
      setCommand('');  // Clear the input field
      return;
    } else if (commands[commandKey as keyof typeof commands]) {
      const cmdFunc = commands[commandKey as keyof typeof commands];
      if (typeof cmdFunc === 'string') {
        output = cmdFunc;
      } else if (typeof cmdFunc === 'function') {
        try {
          if (commandKey === 'echo' || commandKey === 'cowsay' || commandKey === 'man' || 
              commandKey === 'find' || commandKey === 'grep' || commandKey === 'sudo') {
            output = cmdFunc(args.join(' '));
          } else if (commandKey === 'cd') {
            output = cmdFunc(args[0] || '');
            outputType = 'success';
          } else if (commandKey === 'cat') {
            output = cmdFunc(args[0] || '');
          } else {
            output = cmdFunc();
          }
        } catch (error: any) {
          output = `Error executing ${commandName}: ${error.message}`;
          outputType = 'error';
        }
      }
    } else {
      output = `Command not found: ${commandName}. Type 'help' for available commands.`;
      outputType = 'error';
    }

    setHistory(prev => [...prev, { command: trimmedCmd, output, type: outputType }]);
    setCommandHistory(prev => [...prev, trimmedCmd]);
    setCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand(command);
      setSuggestions([]);
      setSuggestionIndex(-1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const newSuggestions = getAutocompleteSuggestions(command);

      if (newSuggestions.length === 1) {
        const parts = command.split(' ');
        if (parts.length === 1) {
          setCommand(newSuggestions[0] + ' ');
        } else {
          const completedArg = newSuggestions[0];
          parts[parts.length - 1] = completedArg;
          setCommand(parts.join(' ') + ' ');
        }
        setSuggestions([]);
        setSuggestionIndex(-1);
      } else if (newSuggestions.length > 1) {
        setSuggestions(newSuggestions);
        setSuggestionIndex(0);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setSuggestionIndex(Math.max(0, suggestionIndex - 1));
      } else if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCommand(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setSuggestionIndex(Math.min(suggestions.length - 1, suggestionIndex + 1));
      } else if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCommand('');
        } else {
          setHistoryIndex(newIndex);
          setCommand(commandHistory[newIndex]);
        }
      }
    } else {
      setSuggestions([]);
      setSuggestionIndex(-1);
      setHistoryIndex(-1);
    }
  };

  useEffect(() => {
    axios.get('/api/client/info')
      .then(response => {
        setClientInfo(response.data);
        setHostname(response.data.hostname || 'javadevjt.tech');
        loadDirectoryContents('portfolio');
        loadDirectoryContents('blog');
      })
      .catch(error => {
        console.error('Error fetching client info:', error);
        setClientInfo({ username: 'visitor', ipAddress: 'unknown', hostname: 'javadevjt.tech' });
      });
  }, []);

  const loadDirectoryContents = (dirName: string) => {
    axios.get(`/api/content/directory/${dirName}`)
      .then(response => {
        const contents = response.data.contents || [];
        const executableContents: any = {};

        contents.forEach((filename: string) => {
          if (filename.endsWith('.md')) {
            const nameWithoutExt = filename.replace('.md', '');
            executableContents[nameWithoutExt] = {
              type: 'executable',
              filename: filename,
              description: `${dirName} post: ${nameWithoutExt}`
            };
          }
        });

        setFileSystem((prev: any) => ({
          ...prev,
          '/home/visitor': {
            ...prev['/home/visitor'],
            contents: {
              ...prev['/home/visitor'].contents,
              [dirName]: {
                type: 'directory',
                contents: executableContents
              }
            }
          }
        }));
      })
      .catch(error => {
        console.error(`Error loading ${dirName} directory:`, error);
      });
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  const typingSpeed: TypingSpeed = turboMode ? 'instant' : 'fast';

  // Format path for display: /home/visitor -> ~, /home/visitor/portfolio -> ~/portfolio
  const getDisplayPath = (path: string) => {
    const homePath = `/home/${clientInfo?.username || 'visitor'}`;
    if (path === homePath) {
      return '~';
    } else if (path.startsWith(homePath + '/')) {
      return '~' + path.substring(homePath.length);
    }
    return path;
  };

  const welcomeMessage = `
╔════════════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                            ║
║       ██╗ ██████╗ ███████╗██╗  ██╗██╗   ██╗ █████╗     ████████╗███████╗██████╗ ██╗  ██╗   ║
║       ██║██╔═══██╗██╔════╝██║  ██║██║   ██║██╔══██╗    ╚══██╔══╝██╔════╝██╔══██╗██║ ██╔╝   ║
║       ██║██║   ██║███████╗███████║██║   ██║███████║       ██║   █████╗  ██████╔╝█████╔╝    ║
║  ██   ██║██║   ██║╚════██║██╔══██║██║   ██║██╔══██║       ██║   ██╔══╝  ██╔══██╗██╔═██╗    ║
║  ╚█████╔╝╚██████╔╝███████║██║  ██║╚██████╔╝██║  ██║       ██║   ███████╗██║  ██║██║  ██╗   ║
║   ╚════╝  ╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝       ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ║
║                                                                                            ║
║              Backend Engineer & In-Vehicle Product Cybersecurity SRE Team Lead             ║
║                                       General Motors                                       ║
║                                                                                            ║
╚════════════════════════════════════════════════════════════════════════════════════════════╝

Welcome to Joshua Terk's Terminal Portfolio

Type 'help' to see available commands or try exploring on your own!
Current location: ${currentPath}
${turboMode ? '⚡ TURBO MODE ENABLED ⚡' : ''}

`;

  const getOutputColor = (type?: 'success' | 'error' | 'info') => {
    switch (type) {
      case 'success': return '#00ff00';
      case 'error': return '#ff5555';
      case 'info':
      default: return '#ffffff';
    }
  };

  return (
    <div style={{
      fontFamily: 'Fira Code, monospace',
      backgroundColor: '#000',
      color: '#00ff00',
      height: '100vh',
      width: '100vw',
      padding: '20px',
      overflow: 'hidden'
    }}>
      <div
        ref={terminalRef}
        style={{
          height: '100%',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          fontSize: '14px',
          lineHeight: '1.4'
        }}
      >
        <div>{welcomeMessage}</div>
        {history.map((item, index) => (
          <div key={index}>
            <div style={{ color: '#00ff00' }}>
              {clientInfo?.username || 'visitor'}@{hostname}:{getDisplayPath(currentPath)}$ {item.command}
            </div>
            <div style={{ color: getOutputColor(item.type), marginBottom: '10px' }}>
              <TypingText 
                text={item.output} 
                speed={typingSpeed}
                enabled={item.output.length < 5000}
              />
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#00ff00', marginRight: '10px' }}>
            {`${clientInfo?.username || 'visitor'}@${hostname}:${getDisplayPath(currentPath)}$`}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#00ff00',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              outline: 'none',
              flex: 1
            }}
            autoFocus
          />
        </div>
        {suggestions.length > 0 && (
          <div style={{
            color: '#888',
            fontSize: '12px',
            marginTop: '5px',
            marginLeft: '20px'
          }}>
            {suggestions.map((suggestion, index) => (
              <span
                key={suggestion}
                style={{
                  color: index === suggestionIndex ? '#00ff00' : '#888',
                  marginRight: '10px'
                }}
              >
                {suggestion}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomTerminalEnhanced;
