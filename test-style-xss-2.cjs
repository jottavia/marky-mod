function check(val) {
    const cleaned = val.replace(/[\x00-\x20\\\/\&\#]/g, '');
    console.log("val:", JSON.stringify(val));
    console.log("cleaned:", JSON.stringify(cleaned));
    console.log("is_exp:", /expression/i.test(cleaned));
}
check("e\\xpression(alert(1))");
check("j&#x09;avascript:alert(1)");
