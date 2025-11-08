import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

interface CommandOutput {
  command: string;
  output: string;
}

const CustomTerminalNew: React.FC = () => {
  const [currentPath, setCurrentPath] = useState('/home/visitor');
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<CommandOutput[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [hostname, setHostname] = useState('javadevjt.tech');
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
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
        'contact.txt': { type: 'file' }
      }
    }
  });

  const commands: any = {
    help: "Available commands:\nhelp        - Show this help message\nls          - List directory contents\nll          - Long list directory contents\ncd          - Change directory\npwd         - Print working directory\ncat         - Display file contents\n./<file>    - Execute file\nwhoami      - Display user info\nbanner      - Display ASCII art banner\nclear       - Clear terminal\nexit        - Close terminal\nmatrix      - Matrix effect (for fun)",
    whoami: () => clientInfo ? `${clientInfo.username}@${hostname} (${clientInfo.ipAddress})` : 'visitor@javadevjt.tech',
    pwd: () => currentPath,
    cd: (directory: string) => {
      let newPath = currentPath;

      if (directory === '..') {
        // Go up one directory
        const pathParts = currentPath.split('/').filter(p => p);
        if (pathParts.length > 2) { // Don't go above /home
          pathParts.pop();
          newPath = '/' + pathParts.join('/');
        }
      } else if (directory === '~' || directory === '') {
        newPath = `/home/${clientInfo?.username || 'visitor'}`;
      } else if (directory.startsWith('/')) {
        // Absolute path
        newPath = directory;
      } else {
        // Relative path
        if (currentPath === `/home/${clientInfo?.username || 'visitor'}`) {
          newPath = `${currentPath}/${directory}`;
        } else {
          return `cd: ${directory}: No such directory`;
        }
      }

      // Check if directory exists
      const currentDir = getCurrentDirectory();
      if (currentDir && currentDir.contents && currentDir.contents[directory] &&
          currentDir.contents[directory].type === 'directory') {
        setCurrentPath(newPath);
        return `Changed directory to ${newPath}`;
      } else if (newPath !== currentPath) {
        // For other valid paths
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
        let owner = 'visitor';
        let group = 'visitor';

        if (entry.type === 'directory') {
          permissions = 'drwxr-xr-x';
          size = '4096';
        } else if (entry.type === 'executable') {
          permissions = '-rwxr-xr-x';
          size = '2048';
        }

        lines.push(`${permissions}  1 ${owner} ${group} ${size.padStart(6)} ${formatDate(now)} ${item}`);
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
I currently work as the leader of an SRE team at General Motors, servicing in-vehicle cryptographic applicatiions
vital to the day-to-day operation of our manufacturing plants and vehicles.

Key Expertise:
• Microservices Architecture & Design Patterns
• Performance Tuning
• API Design & RESTful Services
• DevOps
• System Security & Authentication
• Distributed Systems & Scalability
• Spring Boot Expert

With a strong foundation in computer science and years of experience in backend development,
I specialize in turning complex business requirements into efficient, maintainable code that
powers modern applications.`;
      } else if (filename === 'contact.txt') {
        return `Contact Information:

Email: joshterk@javadevjt.tech
GitHub: https://www.github.com/javadevjt
LinkedIn: https://www.linkedin.com/in/joshuaterk/

I'm always interested in discussing new opportunities, especially in backend engineering,
system architecture, and scalable application development.`;
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
    matrix: () => {
      return `Matrix Effect Activated!

01010100 01101000 01100101 00100000 01001101 01100001 01110100 01110010 01101001 01111000 00100000 01101000 01100001 01110011 00100000 01111001 01101111 01110101 00101110

Wake up, Neo...
The Matrix has you...
Follow the white rabbit.

Type 'clear' to exit the matrix.`;
    },
    echo: (args: string) => args,
    clear: () => {
      setHistory([]);
      return '';
    }
  };

  const getCurrentDirectory = () => {
    const pathParts = currentPath.split('/').filter(p => p);
    let current = fileSystem['/home/visitor'];

    for (let i = 2; i < pathParts.length; i++) { // Skip /home/visitor
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
      // Suggest all commands if input is empty
      return Object.keys(commands).filter(cmd => typeof commands[cmd] !== 'function' || cmd !== 'clear');
    }

    const parts = input.split(' ');
    const currentCmd = parts[0];
    const args = parts.slice(1);

    // If we're typing the first word (command)
    if (parts.length === 1) {
      return Object.keys(commands).filter(cmd =>
        cmd.startsWith(currentCmd) && (typeof commands[cmd] !== 'function' || cmd !== 'clear')
      );
    }

    // If we're typing arguments (file/directory names)
    const currentArg = args[args.length - 1] || '';
    const currentDir = getCurrentDirectory();

    if (currentDir && currentDir.contents) {
      const items = Object.keys(currentDir.contents);
      return items.filter(item => item.startsWith(currentArg));
    }

    return [];
  };

  // Handle ./filename execution
  const executeFile = async (filename: string): Promise<string> => {
    const currentDir = getCurrentDirectory();
    if (!currentDir || !currentDir.contents) {
      return `./${filename}: No such file or directory`;
    }

    // Find file case-insensitively
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

    // Determine the path for the backend request
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

  const executeCommand = (cmd: string) => {
    const trimmedCmd = cmd.trim();
    if (!trimmedCmd) return;

    const [commandName, ...args] = trimmedCmd.split(' ');
    const commandKey = commandName.toLowerCase();

    let output = '';

    if (commandKey === 'clear') {
      commands.clear();
      return;
    }

    // Handle ./filename execution
    if (commandKey.startsWith('./')) {
      const filename = commandKey.substring(2);
      executeFile(filename).then((result: string) => {
        setHistory(prev => [...prev, { command: trimmedCmd, output: result }]);
        setCommandHistory(prev => [...prev, trimmedCmd]);
      }).catch((error: any) => {
        setHistory(prev => [...prev, { command: trimmedCmd, output: `Error: ${error.message}` }]);
        setCommandHistory(prev => [...prev, trimmedCmd]);
      });
      return; // Don't add to history here since it's async
    } else if (commands[commandKey as keyof typeof commands]) {
      const cmdFunc = commands[commandKey as keyof typeof commands];
      if (typeof cmdFunc === 'string') {
        output = cmdFunc;
      } else if (typeof cmdFunc === 'function') {
        if (commandKey === 'echo') {
          output = cmdFunc(args.join(' '));
        } else if (commandKey === 'ls' || commandKey === 'll') {
          output = cmdFunc();
        } else if (commandKey === 'cd') {
          output = cmdFunc(args[0] || '');
        } else if (commandKey === 'cat') {
          output = cmdFunc(args[0] || '');
        } else {
          output = (cmdFunc as () => string)();
        }
      }
    } else {
      output = `Command not found: ${commandName}. Type 'help' for available commands.`;
    }

    setHistory(prev => [...prev, { command: trimmedCmd, output }]);
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
        // If only one suggestion, complete it
        const parts = command.split(' ');
        if (parts.length === 1) {
          setCommand(newSuggestions[0] + ' ');
        } else {
          // Complete the last argument
          const completedArg = newSuggestions[0];
          parts[parts.length - 1] = completedArg;
          setCommand(parts.join(' ') + ' ');
        }
        setSuggestions([]);
        setSuggestionIndex(-1);
      } else if (newSuggestions.length > 1) {
        // Show suggestions
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
      // Clear suggestions when typing
      setSuggestions([]);
      setSuggestionIndex(-1);
      setHistoryIndex(-1);
    }
  };

  useEffect(() => {
    // Fetch client information and directory structure
    axios.get('/api/client/info')
      .then(response => {
        setClientInfo(response.data);
        setHostname(response.data.hostname || 'javadevjt.tech');

        // Load directory contents
        loadDirectoryContents('portfolio');
        loadDirectoryContents('blog');
      })
      .catch(error => {
        console.error('Error fetching client info:', error);
        setClientInfo({ username: 'visitor', ipAddress: 'unknown' });
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

Type 'help' to see available commands or 'banner' to display this banner again.
Current location: ${currentPath}

`;

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
              {clientInfo?.username || 'visitor'}@{hostname}:~$ {item.command}
            </div>
            <div style={{ color: '#ffffff', marginBottom: '10px' }}>
              {item.output}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#00ff00', marginRight: '10px' }}>
            {clientInfo?.username || 'visitor'}@{hostname}:~$
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

export default CustomTerminalNew;
