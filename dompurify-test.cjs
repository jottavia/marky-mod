const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

console.log(DOMPurify.sanitize('<img src=x onerror=alert(1)>'));
console.log(DOMPurify.sanitize('<a href="javascript:alert(1)">Click</a>'));
console.log(DOMPurify.sanitize('<a href="j&#x09;avascript:alert(1)">Click</a>'));
console.log(DOMPurify.sanitize('<math><mtext><table></table></mtext></math>'));
