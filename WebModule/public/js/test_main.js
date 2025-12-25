let currentQuestionIndex = 0;
let correctAnswerCount = 0;
const testQuestions = [
  {
    question: "Какое свойство CSS отвечает за управление пространством между границей и контентом элемента?",
    answers: ["margin", "border", "padding", "width"],
    correctAnswer: "padding",
    explanation: "Свойство padding устанавливает внутренние отступы между контентом элемента и его границей, увеличивая видимое пространство вокруг контента внутри элемента.",
},
{
    question: "Что делает свойство position: absolute; в CSS?",
    answers: ["Располагает элемент в потоке документа", "Располагает элемент относительно окна браузера", "Располагает элемент относительно его нормальной позиции", "Располагает элемент относительно ближайшего позиционированного предка"],
    correctAnswer: "Располагает элемент относительно ближайшего позиционированного предка",
    explanation: "Свойство position: absolute; позиционирует элемент относительно его ближайшего позиционированного предка вместо обычной поточной позиции.",
},
{
    question: "Какое свойство CSS определяет, как элементы будут распределяться вдоль главной оси контейнера flex?",
    answers: ["align-items", "justify-content", "flex-direction", "flex-wrap"],
    correctAnswer: "justify-content",
    explanation: "Свойство justify-content управляет распределением между элементами вдоль главной оси контейнера flex, позволяя, например, выравнивать их по центру или распределять с равными отступами.",
},
{
    question: "Какой элемент HTML используется для определения независимого раздела или раздела на странице?",
    answers: ["section", "div", "header", "span"],
    correctAnswer: "section",
    explanation: "Элемент <section> предназначен для разметки независимого раздела документа, который может быть автономным, что делает его идеальным для разделов страницы, содержащих сопутствующую группу контента.",
},
{
    question: "Какое значение свойства display создает новый блочный контекст форматирования?",
    answers: ["inline", "block", "flex", "inline-block"],
    correctAnswer: "block",
    explanation: "Значение block свойства display заставляет элемент вести себя как блочный, что означает, что он начинается с новой строки и занимает всю доступную ширину.",
},

];

// console.log(testQuestions[0].answers[3]);
// console.log(testQuestions[1].answers[1]);

document.querySelector(".next-button").addEventListener("click", () => submitAnswer());

let currentQuestion = document.getElementById("currentQuestion");
// console.log(typeof currentQuestion)
// console.log(document.querySelector(".next-button"));

function submitAnswer() {
  const selectedAnswer = document.querySelector('input[type="radio"]:checked');
  if (!selectedAnswer) {
    alert("Пожалуйста, выберите ответ");
    return;
  }

  const question = testQuestions[currentQuestionIndex];
  if (selectedAnswer.value === question.correctAnswer) {
    correctAnswerCount++;
  }

  nextQuestion();
  // console.log(correctAnswerCount);
}

function nextQuestion() {
  if (currentQuestionIndex < testQuestions.length - 1) {
    currentQuestionIndex++;
    currentQuestion.textContent = parseInt(currentQuestion.textContent) + 1;
    displayQuestion();
  } else {
    finishTest();
  }
}

function displayQuestion() {
  document.querySelector(".question-title").textContent = `Вопрос ${currentQuestionIndex + 1}: ${testQuestions[currentQuestionIndex].question}`;
  const answersList = document.querySelector('.answers-list');
  answersList.textContent = "";
  //console.log(answersList);
   for (let i = 0; i < testQuestions[currentQuestionIndex].answers.length; i++){
      // console.log(testQuestions[currentQuestionIndex].answers[i]);
      const listItem = document.createElement("li");
      listItem.className = "answers-item";

      const input = document.createElement("input");
      input.type = "radio";
      input.id = `answer + ${i+1}`;
      input.name = `question${currentQuestionIndex}`;
      input.value = testQuestions[currentQuestionIndex].answers[i];
      if (i === 0) {
         input.checked = true;
      }

      const label = document.createElement("label");
      label.htmlFor = input.id;
      label.textContent = `${getSringBYNumIter(i)} ${testQuestions[currentQuestionIndex].answers[i]}`;

      listItem.appendChild(input);
      listItem.appendChild(label);
      answersList.appendChild(listItem)

   }
}

function getSringBYNumIter(number) {
   arrStr = ["A)", "B)", "C)", "D)"];
   return arrStr[number];

}
 
function finishTest() {
  const score = (correctAnswerCount / testQuestions.length) * 100;
  if (score >= 60) {
      alert(`Вы успешно прошли тест. Ваш результат ${score}% `);
  } else {
    alert(`Вы не прошли тест. Ваш результат ${score}% `);
  }

  currentQuestionIndex = 0;
  correctAnswerCount = 0;
  currentQuestion.textContent = 1;
  displayQuestion();
}
