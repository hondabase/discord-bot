export default milliseconds => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours   = Math.floor(minutes / 60);
    const days    = Math.floor(hours / 24);
    const years   = Math.floor(days / 365);

    return years > 0 ? `${years} year${years !== 1 ? 's' : ''}, ${days % 365} day${days % 365 !== 1 ? 's' : ''}`
           : days > 0 ? `${days} day${days !== 1 ? 's' : ''}`
           : hours > 0 ? `${hours} hour${hours !== 1 ? 's' : ''}`
           : minutes > 0 ? `${minutes} minute${minutes !== 1 ? 's' : ''}`
           : `${seconds} second${seconds !== 1 ? 's' : ''}`;
};
