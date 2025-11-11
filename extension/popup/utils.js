function parseApiError(response, defaultMessage) {
    return response.text().then(text => {
        if (!text) {
            return defaultMessage;
        }
        
        try {
            const errorData = JSON.parse(text);
            
            if (errorData.detail) {
                if (typeof errorData.detail === 'string') {
                    return errorData.detail;
                }
                
                if (errorData.detail.message && typeof errorData.detail.message === 'string') {
                    return errorData.detail.message;
                }
                
                if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
                    return errorData.detail.map(e => {
                        if (typeof e === 'string') return e;
                        if (e && typeof e === 'object') {
                            const field = e.loc && Array.isArray(e.loc) && e.loc.length > 1 
                                ? e.loc[e.loc.length - 1] 
                                : 'field';
                            const message = e.msg || e.message || 'Validation error';
                            return `${field}: ${message}`;
                        }
                        return String(e);
                    }).filter(msg => msg).join('; ');
                }
                
                if (typeof errorData.detail === 'object' && errorData.detail !== null) {
                    return errorData.detail.message || JSON.stringify(errorData.detail);
                }
                
                return String(errorData.detail);
            }
            
            if (errorData.message) {
                return errorData.message;
            }
            
            return text;
        } catch (e) {
            return text || defaultMessage;
        }
    }).catch(() => {
        return defaultMessage;
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function createElement(tag, className, textContent) {
    const element = document.createElement(tag);
    if (className) {
        element.className = className;
    }
    if (textContent !== undefined) {
        element.textContent = textContent;
    }
    return element;
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password && password.length >= 8;
}

