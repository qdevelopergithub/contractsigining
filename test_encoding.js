
const testString = JSON.stringify({ category: "Men’s", other: "Accessories – Jewelry" }); // Contains smart quote and en-dash

try {
    console.log("Original:", testString);

    // New Logic
    const encoded = btoa(encodeURIComponent(testString));
    console.log("Encoded:", encoded);

    const decoded = decodeURIComponent(atob(encoded));
    console.log("Decoded:", decoded);

    if (testString === decoded) {
        console.log("SUCCESS: Encoding and decoding works for Unicode.");
    } else {
        console.log("FAILURE: Decoded string does not match original.");
    }
} catch (e) {
    console.error("ERROR:", e.message);
}

// simulate old logic failure
try {
    btoa(testString);
} catch (e) {
    console.log("Confirmed: Old logic fails as expected:", e.message);
}
