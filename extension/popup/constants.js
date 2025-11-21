const RETRY_CONFIG = {
    MAX_RETRIES: 3,
    DELAY_MS: 200
};

const ELEMENT_SCORES = {
    TEXTAREA: 100,
    TEXT_INPUT: 80,
    CONTENTEDITABLE: 70,
    TEXTBOX_ROLE: 60,
    HAS_PLACEHOLDER: 20,
    WIDTH_LARGE: 30,
    HEIGHT_LARGE: 30,
    WIDTH_XLARGE: 20,
    HEIGHT_XLARGE: 20
};

const SIZE_THRESHOLDS = {
    WIDTH_LARGE: 300,
    HEIGHT_LARGE: 50,
    WIDTH_XLARGE: 500,
    HEIGHT_XLARGE: 100
};

const ERROR_CODES = {
    INSERT_FAILED: 'insert_failed',
    INSERT_ERROR: 'insert_error',
    GENERAL_ERROR: 'general_error',
    NO_ACTIVE_TAB: 'no_active_tab',
    INVALID_URL: 'invalid_url',
    CHROME_PAGE: 'chrome_page'
};

const CHROME_PROTOCOLS = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:'
];

const CHROME_NEWTAB = 'chrome://newtab/';

const CHROME_SPECIAL_URLS = [
    'chrome://newtab/',
    'chrome://extensions/',
    'edge://newtab/'
];

const INPUT_SELECTORS = [
    'textarea',
    'input[type="text"]',
    'input:not([type])',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'div[contenteditable]',
    '[data-placeholder]',
    '[placeholder]'
];

