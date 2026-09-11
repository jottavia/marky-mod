function check(val) {
    const r1 = /^\s*javascript:/i.test(val);
    const r2 = /^[\x00-\x20]*javascript:/i.test(val);
    const r3 = /^[\x00-\x20]*j[\x00-\x20]*a[\x00-\x20]*v[\x00-\x20]*a[\x00-\x20]*s[\x00-\x20]*c[\x00-\x20]*r[\x00-\x20]*i[\x00-\x20]*p[\x00-\x20]*t[\x00-\x20]*:/i.test(val);
    const cleaned = val.replace(/[\x00-\x20]/g, '');
    const r4 = /^javascript:/i.test(cleaned);

    console.log("val:", JSON.stringify(val));
    console.log("  r1:", r1);
    console.log("  r2:", r2);
    console.log("  r3:", r3);
    console.log("  r4:", r4);
}
check("j\tavascript:alert(1)");
check("\u0001javascript:alert(1)");
check("java\nscript:alert(1)");
check("\u000ejavascript:alert(1)");
