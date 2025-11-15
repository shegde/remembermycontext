function formatDate(dateString) {
    if (!dateString) return 'Never';
    
    let date;
    if (typeof dateString === 'string') {
        const hasTimezone = dateString.includes('Z') || dateString.includes('+') || dateString.match(/[+-]\d{2}:\d{2}$/);
        if (!hasTimezone && dateString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
            date = new Date(dateString + 'Z');
        } else {
            date = new Date(dateString);
        }
    } else {
        date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const day = date.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
}

function formatDateTime(dateString) {
    if (!dateString) return 'Never';
    
    let date;
    if (typeof dateString === 'string') {
        let normalizedDate = dateString.trim();
        
        if (normalizedDate.includes('+00:00')) {
            normalizedDate = normalizedDate.replace('+00:00', 'Z');
            date = new Date(normalizedDate);
        } else if (normalizedDate.match(/[+-]\d{2}:\d{2}$/) && !normalizedDate.includes('Z')) {
            date = new Date(normalizedDate);
        } else if (!normalizedDate.includes('Z') && !normalizedDate.includes('+') && !normalizedDate.match(/[+-]\d{2}:\d{2}$/)) {
            if (normalizedDate.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
                normalizedDate = normalizedDate + 'Z';
            }
            date = new Date(normalizedDate);
        } else {
            date = new Date(normalizedDate);
        }
    } else {
        date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const day = date.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${day} ${month} ${year}, ${hours}:${minutes}:${seconds}`;
}

