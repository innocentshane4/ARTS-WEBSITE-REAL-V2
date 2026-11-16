/** ARTS - Sign in controller (User and Administrator) */
const $ = (id) => document.getElementById(id);
let role = "user", registering = false, pendingTotpUid = null;

function render() {
  const admin = role === "admin", reg = registering && !admin;
  document.querySelectorAll(".role-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.role === role));
  pendingTotpUid = null;
  $("totpForm").hidden = true;
  $("loginForm").hidden = false;
  $("socialBlock").hidden = false;
  $("title").textContent = admin ? "Administrator sign in" : reg ? "Create your account" : "Welcome back";
  $("lede").textContent = admin ? "Manage incidents, services, and users." : reg ? "Register to report and track incidents." : "Sign in to report and track incidents.";
  $("nameField").hidden = !reg;
  $("swapRow").hidden = admin;
  $("forgotRow").hidden = reg;
  $("adminHint").hidden = !admin;
  $("loginBtn").textContent = reg ? "Create account" : "Sign in";
  $("swapText").textContent = reg ? "Already registered?" : "New to ARTS?";
  $("swapBtn").textContent = reg ? "Sign in" : "Create an account";
  $("password").autocomplete = reg ? "new-password" : "current-password";
  $("loginError").classList.remove("show");
}

function showTotpStep(uid) {
  pendingTotpUid = uid;
  $("loginForm").hidden = true;
  $("socialBlock").hidden = true;
  $("swapRow").hidden = true;
  $("totpForm").hidden = false;
  $("totpCode").value = "";
  $("totpError").classList.remove("show");
  $("totpCode").focus();
}

document.querySelectorAll(".role-tabs button").forEach((b) => (b.onclick = () => { role = b.dataset.role; registering = false; render(); }));
$("swapBtn").onclick = () => { registering = !registering; render(); };
$("pwToggle").onclick = () => {
  const show = $("password").type === "password";
  $("password").type = show ? "text" : "password";
  $("pwToggle").textContent = show ? "Hide" : "Show";
};

function fail(msg) { const e = $("loginError"); e.textContent = msg; e.classList.add("show"); }
function failTotp(msg) { const e = $("totpError"); e.textContent = msg; e.classList.add("show"); }

function handleUserResult(result) {
  if (result.requiresTotp) showTotpStep(result.uid);
  else location.href = "user.html";
}

function setBusy(busy) {
  $("loginBtn").disabled = busy;
  $("googleBtn").disabled = busy;
}

/** If a saved Firebase session exists, send the visitor straight to the right place. */
(async function resumeSession() {
  const user = await authReady;
  if (!user) return;
  if (await fbIsAdmin(user.uid)) { location.replace("dashboard.html"); return; }
  if (await UserAuth.totpPending(user.uid)) { showTotpStep(user.uid); return; }
  location.replace("user.html");
})();

$("loginForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const email = $("email").value.trim(), password = $("password").value, name = $("name").value.trim();
  const reg = registering && role === "user";
  if (!email || !password) return fail("Enter your email and password.");
  if (reg && !name) return fail("Enter your full name.");
  if (reg && password.length < 8) return fail("Use a password of at least 8 characters.");
  setBusy(true);
  try {
    if (role === "admin") { await AuthStore.login(email, password); location.href = "dashboard.html"; return; }
    handleUserResult(reg ? await UserAuth.register(name, email, password) : await UserAuth.login(email, password));
  } catch (err) {
    fail(err.message || "Something went wrong. Please try again.");
  } finally {
    setBusy(false);
  }
});

$("googleBtn").addEventListener("click", async () => {
  $("loginError").classList.remove("show");
  setBusy(true);
  try {
    if (role === "admin") { await AuthStore.loginWithGoogle(); location.href = "dashboard.html"; return; }
    handleUserResult(await UserAuth.loginWithGoogle());
  } catch (err) {
    fail(err.message || "Google sign-in failed. Please try again.");
  } finally {
    setBusy(false);
  }
});

$("forgotBtn").addEventListener("click", async () => {
  const email = $("email").value.trim();
  if (!email) return fail("Type your email address above, then press Forgot password.");
  try {
    await fbAuth.sendPasswordResetEmail(email);
    $("loginError").classList.remove("show");
    alert("If an account exists for " + email + ", a password reset link is on its way. Check your inbox and spam folder.");
  } catch (err) {
    fail(friendlyAuthError(err));
  }
});

$("totpForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!pendingTotpUid) return;
  $("totpBtn").disabled = true;
  try {
    await UserAuth.completeTotpLogin(pendingTotpUid, $("totpCode").value);
    location.href = "user.html";
  } catch (err) {
    failTotp(err.message || "Incorrect code, please try again.");
  } finally {
    $("totpBtn").disabled = false;
  }
});
$("totpBack").onclick = async () => { await UserAuth.logout(); render(); };

render();
