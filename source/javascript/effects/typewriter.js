export function typewriter(element, speed) {
    var text = element.innerHTML;
    var cursorPosition = 0;
    element.innerHTML = "";

    function type() {
        if (cursorPosition < text.length) {
            element.innerHTML += text.charAt(cursorPosition);
            cursorPosition++;
            setTimeout(type, speed);
        } else {
            setTimeout(deleteChars, 1000);
        }
    }

    function deleteChars() {
        if (cursorPosition > 0) {
            element.innerHTML = text.substring(0, cursorPosition - 1);
            cursorPosition--;
            setTimeout(deleteChars, speed);
        } else {
            cursorPosition = 0;
            setTimeout(type, 1000);
        }
    }

    type();
}