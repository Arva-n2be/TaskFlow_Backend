const SHORTCUT_CATALOG = [
    { id: 'gmail', name: 'Gmail', url: 'https://mail.google.com', domain: 'mail.google.com' },
    { id: 'gdocs', name: 'Google Docs', url: 'https://docs.google.com', domain: 'docs.google.com' },
    { id: 'gsheets', name: 'Google Sheets', url: 'https://sheets.google.com', domain: 'sheets.google.com' },
    { id: 'gdrive', name: 'Google Drive', url: 'https://drive.google.com', domain: 'drive.google.com' },
    { id: 'gcalendar', name: 'Google Calendar', url: 'https://calendar.google.com', domain: 'calendar.google.com' },
    { id: 'gmeet', name: 'Google Meet', url: 'https://meet.google.com', domain: 'meet.google.com' },
    { id: 'figma', name: 'Figma', url: 'https://www.figma.com', domain: 'figma.com' },
    { id: 'drawio', name: 'draw.io', url: 'https://app.diagrams.net', domain: 'app.diagrams.net' },
    { id: 'canva', name: 'Canva', url: 'https://www.canva.com', domain: 'canva.com' },
    { id: 'notion', name: 'Notion', url: 'https://www.notion.so', domain: 'notion.so' },
    { id: 'slack', name: 'Slack', url: 'https://slack.com', domain: 'slack.com' },
    { id: 'trello', name: 'Trello', url: 'https://trello.com', domain: 'trello.com' },
    { id: 'asana', name: 'Asana', url: 'https://app.asana.com', domain: 'asana.com' },
    { id: 'github', name: 'GitHub', url: 'https://github.com', domain: 'github.com' },
    { id: 'gitlab', name: 'GitLab', url: 'https://gitlab.com', domain: 'gitlab.com' },
    { id: 'linear', name: 'Linear', url: 'https://linear.app', domain: 'linear.app' },
    { id: 'miro', name: 'Miro', url: 'https://miro.com', domain: 'miro.com' },
    { id: 'zoom', name: 'Zoom', url: 'https://zoom.us', domain: 'zoom.us' },
    { id: 'discord', name: 'Discord', url: 'https://discord.com/app', domain: 'discord.com' },
    { id: 'spotify', name: 'Spotify', url: 'https://open.spotify.com', domain: 'open.spotify.com' },
    { id: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com', domain: 'chat.openai.com' },
    { id: 'claude', name: 'Claude', url: 'https://claude.ai', domain: 'claude.ai' },
    { id: 'outlook', name: 'Outlook', url: 'https://outlook.live.com', domain: 'outlook.live.com' },
    { id: 'onedrive', name: 'OneDrive', url: 'https://onedrive.live.com', domain: 'onedrive.live.com' },
];

const DEFAULT_SHORTCUT_IDS = ['gmail', 'gdocs', 'figma', 'drawio', 'canva'];
const VALID_IDS = new Set(SHORTCUT_CATALOG.map((s) => s.id));

module.exports = { SHORTCUT_CATALOG, DEFAULT_SHORTCUT_IDS, VALID_IDS };
