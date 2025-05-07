const toggle = () => {
    document.querySelector("#buttons").classList.toggle("noinfo");
}
document.querySelector("#toggle").addEventListener("click", () => toggle());