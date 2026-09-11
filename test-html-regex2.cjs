function check(val) {
    const r5 = /^\s*javascript:/i.test(val.replace(/[\x00-\x20]/g, ''));
    console.log("val:", JSON.stringify(val));
    console.log("  r5:", r5);
}
check("j\tavascript:alert(1)");
check("\u0001javascript:alert(1)");
check("java\nscript:alert(1)");
check("\u000ejavascript:alert(1)");
