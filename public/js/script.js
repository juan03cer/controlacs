const wrapper = document.querySelector(".wrapper"),
    button = document.querySelector("header button"),
    signIn = document.querySelector(".form #sign-in"),
    signUp = document.querySelector(".form #sign-up"),
    icon = document.querySelector(".wrapper #close");

signUp.addEventListener("click", () => wrapper.classList.add("active"));
signIn.addEventListener("click", () => wrapper.classList.remove("active"));

button.addEventListener("click", () => wrapper.classList.add("popup"));
icon.addEventListener("click", () => wrapper.classList.remove("popup"));