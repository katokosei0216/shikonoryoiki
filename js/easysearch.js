// お酒は従来の10問を維持。紙・電子タバコではDBにある商品属性を尋ねる10問に切り替える。
// 簡単検索は診断用の目安であり、健康への影響や安全性を判定するものではありません。
const TOBACCO_QUIZ = {
  cigarette: [
    ['重視するブランドは？', ['メビウス', 'キャメル', 'マールボロ', 'ケント', '特にこだわらない'], 'E'],
    ['香味の種類は？', ['レギュラー', 'メンソール', '香り付きメンソール', 'カプセル・メンソール', '特にこだわらない'], 'E'],
    ['表示タール量の目安は？', ['1mg前後', '3mg前後', '5～6mg前後', '8～10mg前後', '12～14mg前後'], 'C'],
    ['表示ニコチン量の目安は？', ['0.1～0.2mg', '0.3～0.4mg', '0.5～0.6mg', '0.7～0.9mg', '1.0～1.2mg'], 'C'],
    ['サイズは？', ['ショート', '標準（KS）', 'ロング（100’s）', 'スリム', '特にこだわらない'], 'E'],
    ['パッケージは？', ['ソフト', 'ボックス', 'どちらでもよい'], 'C'],
    ['カプセルの有無は？', ['カプセル入り', 'カプセルなし', 'どちらでもよい'], 'C'],
    ['1箱の入数は？', ['10本入り', '20本入り', 'どちらでもよい'], 'C'],
    ['登録価格の目安は？', ['450円前後', '470円前後', '500円前後', '580円前後', '620円以上'], 'C'],
    ['最も重視したい条件は？', ['タール量', 'ニコチン量', '価格', '香味・ブランド', '全体のバランス'], 'E']
  ],
  vape: [
    ['製品シリーズは？', ['TEREA（テリア）', 'SENTIA（センティア）', 'どちらでもよい'], 'C'],
    ['香りの強さは？（5段階）', ['1：控えめ', '2：やや控えめ', '3：ふつう', '4：やや強い', '5：強い'], 'C'],
    ['コクは？（5段階）', ['1：軽い', '2：やや軽い', '3：ふつう', '4：やや濃い', '5：濃い'], 'C'],
    ['吸いごたえは？（5段階）', ['1：穏やか', '2：やや穏やか', '3：ふつう', '4：やや強い', '5：強い'], 'C'],
    ['種類は？', ['レギュラー', 'メンソール', 'フレーバー・メンソール', 'カプセル入りメンソール', '特にこだわらない'], 'E'],
    ['カプセルの有無は？', ['カプセル入り', 'カプセルなし', 'どちらでもよい'], 'C'],
    ['フレーバーの強さは？', ['強めのフレーバーがよい', 'フレーバーは控えめがよい', 'どちらでもよい'], 'C'],
    ['メンソールの有無は？', ['メンソールがよい', 'メンソールなしがよい', 'どちらでもよい'], 'C'],
    ['対応機器は？', ['IQOS ILUMA対応', '従来のIQOS対応', '特にこだわらない'], 'A'],
    ['最も重視したい条件は？', ['香り', 'コク', '吸いごたえ', '香味の種類', '全体のバランス'], 'E']
  ]
};

function getQuizType() {
  const mode = new URLSearchParams(location.search).get('type');
  if (mode === 'vape') return 'vape';
  if (mode === 'paper' || mode === 'cigarette' || mode === 'tobacco') return 'cigarette';
  return 'alcohol';
}

let activeQuizType = getQuizType();
document.addEventListener('DOMContentLoaded', () => {
  if (activeQuizType !== 'alcohol') renderTobaccoQuiz(activeQuizType);
  restoreAnswers();
  const button = document.getElementById('showResult');
  if (!button) return;
  button.addEventListener('click', e => {
    e.preventDefault();
    const answers = collectAnswers();
    if (!answers) return;
    const key = activeQuizType === 'alcohol' ? 'easyAnswers' : 'easyAnswers_' + activeQuizType;
    try {
      sessionStorage.setItem(key, JSON.stringify(answers));
      sessionStorage.setItem('easyLastType', activeQuizType);
    } catch (_e) {
      alert('回答を保存できませんでした。ブラウザの設定を確認してください。');
      return;
    }
    location.href = 'easyanswer.html?type=' + encodeURIComponent(activeQuizType);
  });
});

function renderTobaccoQuiz(type) {
  const title = document.getElementById('easySearchTitle');
  if (title) title.textContent = (type === 'vape' ? '電子タバコ' : '紙タバコ') + 'の簡単検索（10の質問）';
  document.title = (type === 'vape' ? '電子タバコ' : '紙タバコ') + 'の簡単検索 | 嗜好の領域';
  const tabs = document.getElementById('tobaccoCategorySelector');
  if (tabs) {
    tabs.hidden = false;
    tabs.querySelectorAll('a[data-type]').forEach(a => {
      a.classList.toggle('is-active', a.dataset.type === type);
      if (a.dataset.type === type) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }
  const note = document.getElementById('easySearchNote');
  if (note) note.hidden = false;

  const list = document.getElementById('easyQuestionList');
  if (!list) return;
  list.replaceChildren(); // お酒専用の設問を混ぜない
  TOBACCO_QUIZ[type].forEach(([question, choices, defaultChoice], index) => {
    const section = document.createElement('section');
    section.className = 'question-item easy-tobacco-question';
    const heading = document.createElement('div');
    heading.className = 'question-title';
    heading.textContent = `Q${index + 1}. ${question}`;
    section.appendChild(heading);
    const group = document.createElement('div');
    group.className = 'radio-options';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', heading.textContent);
    choices.forEach((choice, i) => {
      const value = String.fromCharCode(65 + i);
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `q${index + 1}`;
      input.value = value;
      input.checked = value === defaultChoice;
      label.append(input, document.createTextNode(value + '. ' + choice));
      group.append(label);
    });
    section.appendChild(group);
    list.appendChild(section);
  });
}

function collectAnswers() {
  const answers = {};
  for (let i = 1; i <= 10; i++) {
    const chosen = document.querySelector(`input[name="q${i}"]:checked`);
    if (!chosen) { alert(`Q${i} に回答してください。`); return null; }
    answers['q' + i] = chosen.value;
  }
  return answers;
}

function restoreAnswers() {
  const key = activeQuizType === 'alcohol' ? 'easyAnswers' : 'easyAnswers_' + activeQuizType;
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (_) { return; }
  if (!saved || typeof saved !== 'object') return;
  for (let i = 1; i <= 10; i++) {
    const v = saved['q' + i];
    const radio = Array.from(document.querySelectorAll(`input[name="q${i}"]`)).find(r => r.value === v);
    if (radio) radio.checked = true;
  }
}
