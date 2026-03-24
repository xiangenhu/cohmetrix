/**
 * InfoModal — Shared "?" help modal with built-in chat.
 *
 * Shows a static explanation, then lets users ask follow-up questions
 * via the /api/help/chat endpoint.
 */
const InfoModal = (() => {
  let factorDefs = [];
  let currentKey = null;
  let chatHistory = [];
  let isLoading = false;

  // Static help entries
  const STATIC = {
    'why-projects': {
      title: 'Why Projects?',
      titleI18n: '2094550a6a8ec7c6',
      body: `<p><span data-i18n="109c9e2fe88d7b37">NeoCohMetrix organizes all your work into</span> <strong data-i18n="2577c0f557b2e4b5">projects</strong>. <span data-i18n="56605d1d5722eed1">Here\u2019s why:</span></p>
<p><strong data-i18n="249daf70f6c51210">Cost control.</strong> <span data-i18n="decb22f949671e02">Every analysis uses LLM tokens that cost real money. Projects let you save configurations and results so you never pay twice for the same analysis. You can re-open past results anytime without re-running.</span></p>
<p><strong data-i18n="88880ef037f26134">Batch analysis.</strong> <span data-i18n="0672d1ea54f02cff">Upload multiple documents to a project and analyze them all with the same settings \u2014 same layers, same genre, same prompt. Consistent evaluation across an entire assignment.</span></p>
<p><strong data-i18n="7b918b7c47ddaac3">Organization.</strong> <span data-i18n="f7ce4f66c3180d10">Each project keeps its files, configuration, and results together. Compare essays within a project, track scores over time, or organize by class, semester, or assignment.</span></p>
<p><strong data-i18n="713fd6eed9082679">Cost estimation.</strong> <span data-i18n="e4d14aeec95a3ac0">Before running any analysis, the system estimates how many tokens it will use and what it will cost. You decide whether to proceed.</span></p>
<p><strong data-i18n="6f0bce26e975f9b8">Reusable configurations.</strong> <span data-i18n="54e50e6c12831654">Set up your analysis layers, genre, and prompt once per project. Every file in that project uses the same settings \u2014 no repetitive setup.</span></p>`,
    },
    'composite-factors': {
      title: 'Composite Factors',
      titleI18n: '1df79fe1f4d42ffb',
      body: `<p data-i18n="ce1abcc37f0edc27">Composite factors are high-level dimensions that combine scores from multiple analysis layers into a single interpretable number. They are analogous to the principal component scores (PC1\u2013PC5) in the original Coh-Metrix, extended here to eight factors (F1\u2013F8).</p>
<p data-i18n="9e8efdcb625ade7a">Each factor captures a distinct aspect of text quality \u2014 narrativity, syntactic accessibility, cohesion depth, argumentation strength \u2014 by weighting the relevant layer scores.</p>
<p data-i18n="c90a2ed0ef54b03c">The radar chart shows all eight factors at once, making it easy to see the essay\u2019s profile at a glance. The dashed circle represents a reference average (70).</p>
<p><strong data-i18n="8215b5413d7c1345">Click the ? next to any individual factor</strong> <span data-i18n="73c81bef3a3a1400">for its definition and scoring formula.</span></p>`,
    },
    'overall-score': {
      title: 'Overall Cohesion Score',
      titleI18n: 'b9783b31958745ff',
      body: `<p data-i18n="700205902c01e315">A single 0\u2013100 number summarizing the essay\u2019s overall text quality. It is a weighted average of all eight composite factors (F1\u2013F8).</p>
<p><strong data-i18n="dab02f65b57e79c8">Default weights:</strong></p>
<ul>
<li data-i18n="96305a0484372348">F6 Argumentation Quality: 20%</li>
<li data-i18n="d8fc6ea2498d9848">F4 Referential Cohesion: 15%</li>
<li data-i18n="69b99f6c62498798">F5 Deep Cohesion: 15%</li>
<li data-i18n="9240a82b14cd146f">F1 Narrativity: 10%</li>
<li data-i18n="87efcc6319b20976">F2 Syntactic Simplicity: 10%</li>
<li data-i18n="a5d88c41c779f3c2">F3 Word Concreteness: 10%</li>
<li data-i18n="bba769e2df336a48">F7 Epistemic Calibration: 10%</li>
<li data-i18n="91de0a4ea682004e">F8 Engagement & Affect: 10%</li>
</ul>
<p data-i18n="0acbc1b07c7ac41f">Argumentation is weighted most heavily because it is the strongest predictor of academic essay grades in the research literature (Wingate, 2012).</p>
<p data-i18n="24e2768af3cdd820">Weights can be customized via environment variables.</p>`,
    },
    'reader-profile': {
      title: 'Reader Profile (L11)',
      titleI18n: '9b81a8bd330c2cf7',
      body: `<p data-i18n="9da628b679daa003">Layer 11 re-scores all metrics relative to a specific learner\u2019s profile. Text difficulty is inherently relational \u2014 what\u2019s complex for a beginner may be routine for an expert.</p>
<p><strong data-i18n="9252e3baa99d99f8">Key metrics:</strong></p>
<ul>
<li><strong data-i18n="1d8fc7f827a94c7f">Vocab level</strong> \u2014 <span data-i18n="37a55ade43ee3fc0">CEFR level (A1\u2013C2) of the reader</span></li>
<li><strong data-i18n="00a0f0aaee5fe9a9">Syntax fluency</strong> \u2014 <span data-i18n="7097b27f5a62ee33">how comfortable the reader is with complex grammar (0\u20131)</span></li>
<li><strong data-i18n="0e92a373ef5bda1b">Domain expertise</strong> \u2014 <span data-i18n="8e3064a74828d1c7">beginner, intermediate, or advanced in the subject</span></li>
<li><strong data-i18n="77307e05be07173f">ZPD proximity</strong> \u2014 <span data-i18n="47d7694d4608e171">how close the text is to the reader\u2019s Zone of Proximal Development (Vygotsky, 1978). Values near 1.0 mean optimally challenging.</span></li>
<li><strong data-i18n="6a47ca863a47bc4a">Difficulty z-score</strong> \u2014 <span data-i18n="276b2b497b42abc3">standard deviations above/below the reader\u2019s baseline</span></li>
<li><strong data-i18n="5a8a7f792a2b5e6d">Scaffold type</strong> \u2014 <span data-i18n="efec4b020c054c69">what kind of instructional support would help</span></li>
</ul>
<p data-i18n="b97eb21d446eff45">This is the most significant innovation of Neo-CohMetrix \u2014 no existing text analysis tool provides learner-relative difficulty scoring.</p>
<p data-i18n="ede03dcad8c0f55e">Requires a Learner ID to be set before analysis.</p>`,
    },
    'priority-feedback': {
      title: 'Priority Feedback',
      titleI18n: 'daaeb957c53c44a9',
      body: `<p data-i18n="56b5ba8a87ddc897">Three targeted, actionable suggestions generated by an AI tutor that has access to all layer scores and metric values.</p>
<p data-i18n="e51cb7c7b7c286bc">The feedback focuses on:</p>
<ol>
<li><strong data-i18n="e74d13e9481b9062">Highest-need area</strong> \u2014 <span data-i18n="f0a46b23877eef92">the dimension where improvement would have the biggest impact</span></li>
<li><strong data-i18n="a573e2fcd9f912d9">Argumentation</strong> \u2014 <span data-i18n="b9b4ae5c1024a90d">strength or gap in the essay\u2019s logical structure</span></li>
<li><strong data-i18n="29de73c72fda8a69">A strength to maintain</strong> \u2014 <span data-i18n="f593a1cdebc7a143">positive reinforcement for what works well</span></li>
</ol>
<p data-i18n="ad8d28f030c2bf9e">Feedback deliberately avoids mentioning metric names or numbers \u2014 it translates the analysis into plain language a student can act on.</p>
<p data-i18n="76f8f3b7df80b419">For deeper exploration, use the Help Chat (? button on any layer) or the Analysis Summary.</p>`,
    },
  };

  function open(key) {
    currentKey = key;
    chatHistory = [];
    clearChat();

    if (STATIC[key]) {
      show(STATIC[key].title, STATIC[key].body, key);
      return;
    }

    if (key.startsWith('factor:')) {
      const fId = key.replace('factor:', '');
      const f = factorDefs.find(d => d.id === fId);
      if (f) {
        const layerTags = f.layers.map(l => `<code>${l}</code>`).join(', ');
        const body = `<p>${f.description}</p>` +
          `<p><strong>Scoring formula:</strong> ${f.scoring}</p>` +
          `<p><strong>Source layers:</strong> ${layerTags}</p>`;
        show(f.id + ' ' + f.label, body, key);
        // Seed chat history with the explanation
        chatHistory.push({ role: 'assistant', text: f.description + ' Scoring: ' + f.scoring });
      }
      return;
    }
  }

  function show(title, bodyHtml, key) {
    const titleEl = document.getElementById('info-title');
    titleEl.textContent = title;
    const entry = STATIC[key];
    if (entry && entry.titleI18n) {
      titleEl.setAttribute('data-i18n', entry.titleI18n);
    } else {
      titleEl.removeAttribute('data-i18n');
    }
    document.getElementById('info-body').innerHTML = bodyHtml;
    // Seed chat with the body text for context
    if (!chatHistory.length) {
      const div = document.createElement('div');
      div.innerHTML = bodyHtml;
      chatHistory.push({ role: 'assistant', text: div.textContent.substring(0, 800) });
    }
    document.getElementById('info-overlay').classList.add('open');
    document.getElementById('info-chat-input').focus();
  }

  function close() {
    document.getElementById('info-overlay').classList.remove('open');
    currentKey = null;
    chatHistory = [];
    isLoading = false;
  }

  function clearChat() {
    const msgs = document.getElementById('info-chat-messages');
    if (msgs) msgs.innerHTML = '';
  }

  function addChatMsg(role, text, loading, i18nKey) {
    const msgs = document.getElementById('info-chat-messages');
    const msg = document.createElement('div');
    msg.className = `info-chat-msg ${role}${loading ? ' loading' : ''}`;
    msg.textContent = text;
    if (i18nKey) msg.setAttribute('data-i18n', i18nKey);
    msgs.appendChild(msg);
    msgs.scrollTop = msgs.scrollHeight;
    return msg;
  }

  async function sendChat() {
    if (isLoading) return;
    const input = document.getElementById('info-chat-input');
    const question = input.value.trim();
    if (!question) return;

    input.value = '';
    addChatMsg('user', question);
    chatHistory.push({ role: 'user', text: question });

    const loadingEl = addChatMsg('assistant', 'Thinking\u2026', true, 'a02f1cea3c1d6c6e');
    isLoading = true;
    document.getElementById('info-chat-send').disabled = true;

    try {
      // Map the key to a help ID the backend understands
      const helpId = currentKey.startsWith('factor:') ? currentKey.replace('factor:', '') : currentKey;

      const resp = await Auth.apiFetch('/api/help/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: helpId,
          question,
          history: chatHistory.slice(-6),
        }),
      });

      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();

      loadingEl.textContent = data.answer;
      loadingEl.classList.remove('loading');
      chatHistory.push({ role: 'assistant', text: data.answer });

      if (typeof TokenFooter !== 'undefined') TokenFooter.onApiResponse(data);
    } catch {
      loadingEl.textContent = 'Sorry, I couldn\u2019t generate a response. Please try again.';
      loadingEl.setAttribute('data-i18n', '381ec54eae37c65a');
      loadingEl.classList.remove('loading');
    }

    isLoading = false;
    document.getElementById('info-chat-send').disabled = false;
    input.focus();
  }

  function init() {
    document.getElementById('info-close-btn').addEventListener('click', close);
    document.getElementById('info-backdrop').addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('info-overlay').classList.contains('open')) {
        close();
        e.stopPropagation();
      }
    });

    // Delegate clicks on .info-btn
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.info-btn');
      if (btn) {
        e.stopPropagation();
        const key = btn.getAttribute('data-info');
        if (key) open(key);
      }
    });

    // Chat send
    document.getElementById('info-chat-send').addEventListener('click', sendChat);
    document.getElementById('info-chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    });

    // Load factor definitions
    fetch('/api/meta').then(r => r.json()).then(meta => {
      if (meta.compositeFactors) factorDefs = meta.compositeFactors;
    }).catch(() => {});
  }

  return { init, open, close };
})();

document.addEventListener('DOMContentLoaded', () => InfoModal.init());
