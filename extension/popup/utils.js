function parseApiError(response, defaultMessage) {
    return response.text().then(text => {
        if (!text) {
            return defaultMessage;
        }
        
        try {
            const errorData = JSON.parse(text);
            
            if (errorData.detail) {
                if (typeof errorData.detail === 'string') {
                    let message = errorData.detail;
                    message = message.replace(/^ValueError:\s*/i, '');
                    message = message.replace(/^value error:\s*/i, '');
                    return message;
                }
                
                if (errorData.detail.message && typeof errorData.detail.message === 'string') {
                    let message = errorData.detail.message;
                    message = message.replace(/^ValueError:\s*/i, '');
                    message = message.replace(/^value error:\s*/i, '');
                    return message;
                }
                
                if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
                    return errorData.detail.map(e => {
                        if (typeof e === 'string') {
                            let message = e;
                            message = message.replace(/^ValueError:\s*/i, '');
                            message = message.replace(/^value error:\s*/i, '');
                            return message;
                        }
                        if (e && typeof e === 'object') {
                            const field = e.loc && Array.isArray(e.loc) && e.loc.length > 1 
                                ? e.loc[e.loc.length - 1] 
                                : 'field';
                            let message = e.msg || e.message || 'Validation error';
                            message = message.replace(/^ValueError:\s*/i, '');
                            message = message.replace(/^value error:\s*/i, '');
                            return `${field}: ${message}`;
                        }
                        return String(e);
                    }).filter(msg => msg).join('; ');
                }
                
                if (typeof errorData.detail === 'object' && errorData.detail !== null) {
                    let message = errorData.detail.message || JSON.stringify(errorData.detail);
                    message = message.replace(/^ValueError:\s*/i, '');
                    message = message.replace(/^value error:\s*/i, '');
                    return message;
                }
                
                let message = String(errorData.detail);
                message = message.replace(/^ValueError:\s*/i, '');
                message = message.replace(/^value error:\s*/i, '');
                return message;
            }
            
            if (errorData.message) {
                let message = errorData.message;
                message = message.replace(/^ValueError:\s*/i, '');
                message = message.replace(/^value error:\s*/i, '');
                return message;
            }
            
            let message = text;
            message = message.replace(/^ValueError:\s*/i, '');
            message = message.replace(/^value error:\s*/i, '');
            return message;
        } catch (e) {
            let message = text || defaultMessage;
            message = message.replace(/^ValueError:\s*/i, '');
            message = message.replace(/^value error:\s*/i, '');
            return message;
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

function sanitizeError(error, fallbackMessage = 'An error occurred. Please try again.') {
    if (!error) return fallbackMessage;
    
    const errorString = typeof error === 'string' ? error : (error.message || error.detail || String(error));
    const lowerError = errorString.toLowerCase();
    
    if (lowerError.includes('permission') || 
        lowerError.includes('manifest') || 
        lowerError.includes('cannot access') ||
        lowerError.includes('extension')) {
        return 'Please reload the extension and try again.';
    }
    
    if (lowerError.includes('network') || 
        lowerError.includes('fetch') || 
        lowerError.includes('connection') ||
        lowerError.includes('timeout')) {
        return 'Network error. Please check your connection.';
    }
    
    if (lowerError.includes('tab') || lowerError.includes('window')) {
        return 'Please open an LLM site first.';
    }
    
    if (lowerError.includes('input') || lowerError.includes('field')) {
        return 'Could not find input field. Try clicking it first.';
    }
    
    if (lowerError.includes('unauthorized') || lowerError.includes('401')) {
        return 'Session expired. Please login again.';
    }
    
    if (lowerError.includes('forbidden') || lowerError.includes('403')) {
        return 'Access denied. Please check your permissions.';
    }
    
    if (lowerError.includes('not found') || lowerError.includes('404')) {
        return 'Resource not found. Please try again.';
    }
    
    if (lowerError.includes('server') || lowerError.includes('500') || lowerError.includes('503')) {
        return 'Server error. Please try again later.';
    }
    
    return fallbackMessage;
}

