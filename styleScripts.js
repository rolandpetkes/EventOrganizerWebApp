document.addEventListener('DOMContentLoaded', () => {
  // adds gray overlay to the image when hovered
  document.querySelectorAll('.image_div').forEach((imgCont) => {
    const img = imgCont.querySelector('img');

    imgCont.addEventListener('mouseover', () => {
      img.classList.add('hover');
    });

    imgCont.addEventListener('mouseout', () => {
      img.classList.remove('hover');
    });
  });
});
