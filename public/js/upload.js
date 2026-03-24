/**
 * Upload — Handles file upload, text paste, and analysis options.
 */
const Upload = (() => {
  let selectedFile = null;

  const SAMPLE_TEXT = `The relationship between artificial intelligence and higher education has evolved significantly over the past decade. AI systems now permeate every aspect of learning, from adaptive tutoring platforms to automated essay evaluation. However, the pedagogical implications of this transformation remain poorly understood.

Researchers have begun to investigate whether AI-enhanced environments improve learning outcomes. Some evidence suggests that personalized learning systems can reduce achievement gaps among diverse student populations. These systems adapt content difficulty based on real-time performance data.

Nevertheless, concerns about over-reliance on automated feedback persist. Students may develop surface strategies rather than deep learning approaches. The motivational effects of AI tutoring systems represent a critical but understudied dimension of this problem.

From a cognitive science perspective, effective learning requires productive struggle and meaningful feedback. AI systems must balance challenge with support to maintain learner engagement. This balance defines the pedagogical value of any intelligent tutoring intervention.

Institutions adopting AI tools must therefore establish clear frameworks for evaluating their educational impact. These frameworks should integrate learning analytics with established theories of cognitive development. Only then can AI serve as a genuine amplifier of human learning potential.`;

  const SAMPLE_PROMPT = 'Discuss the pedagogical implications of AI in higher education (800–1000 words).';

  function init() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const essayText = document.getElementById('essay-text');

    // Drag & drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag');
      if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    // Browse button
    document.getElementById('browse-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    // Click on drop zone
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) {
        handleFile(fileInput.files[0]);
      }
    });

    // Option chips
    document.querySelectorAll('.opt-chip').forEach(chip => {
      chip.addEventListener('click', () => chip.classList.toggle('on'));
    });

    // Run buttons
    document.getElementById('run-btn').addEventListener('click', startAnalysis);
    const readyRunBtn = document.getElementById('ready-run-btn');
    if (readyRunBtn) readyRunBtn.addEventListener('click', startAnalysisFromReady);

    // Change document button
    const changeBtn = document.getElementById('ready-change-btn');
    if (changeBtn) changeBtn.addEventListener('click', showBrowseState);

    // Sample link
    document.getElementById('sample-link').addEventListener('click', loadSample);

    // Detect text paste — show ready state when user pastes or types enough text
    if (essayText) {
      essayText.addEventListener('input', () => {
        const text = essayText.value.trim();
        if (text.length > 50 && document.getElementById('upload-ready-section').style.display === 'none') {
          const wordCount = text.split(/\s+/).length;
          showReadyState('Pasted Text', `${wordCount} words`);
        }
      });
    }

    // Populate genre dropdown
    populateGenres();
  }

  async function populateGenres() {
    const select = document.getElementById('genre-select');
    if (!select) return;
    try {
      const resp = await fetch('/api/genres');
      if (!resp.ok) return;
      const data = await resp.json();
      (data.categories || []).forEach(cat => {
        const group = document.createElement('optgroup');
        group.label = cat.category;
        cat.genres.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.id;
          opt.textContent = g.name;
          opt.title = g.description;
          group.appendChild(opt);
        });
        select.appendChild(group);
      });
    } catch { /* silently fail — genre is optional */ }
  }

  function handleFile(file) {
    const validExts = ['.txt', '.docx', '.pdf'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!validExts.includes(ext)) {
      alert('Unsupported file format. Please use .txt, .docx, or .pdf');
      return;
    }
    selectedFile = file;
    document.getElementById('drop-title').textContent = file.name;
    document.getElementById('drop-sub').textContent = `${(file.size / 1024).toFixed(1)} KB · Ready to analyze`;
    showReadyState(file.name, `${(file.size / 1024).toFixed(1)} KB · ${ext.replace('.', '').toUpperCase()}`);
  }

  function showReadyState(name, info) {
    const browseEl = document.getElementById('upload-browse-section');
    const optionsEl = document.getElementById('upload-options-section');
    const readyEl = document.getElementById('upload-ready-section');
    if (browseEl) browseEl.style.display = 'none';
    if (optionsEl) optionsEl.style.display = 'none';
    if (readyEl) {
      readyEl.style.display = 'block';
      document.getElementById('ready-filename').textContent = name;
      document.getElementById('ready-fileinfo').textContent = info;
      // Copy genre options to ready section if not already done
      const readyGenre = document.getElementById('ready-genre');
      const mainGenre = document.getElementById('genre-select');
      if (readyGenre && mainGenre && readyGenre.options.length <= 1) {
        readyGenre.innerHTML = mainGenre.innerHTML;
      }
    }
  }

  function showBrowseState() {
    const browseEl = document.getElementById('upload-browse-section');
    const optionsEl = document.getElementById('upload-options-section');
    const readyEl = document.getElementById('upload-ready-section');
    if (browseEl) browseEl.style.display = '';
    if (optionsEl) optionsEl.style.display = '';
    if (readyEl) readyEl.style.display = 'none';
    selectedFile = null;
    document.getElementById('essay-text').value = '';
    document.getElementById('drop-title').textContent = 'Drop your essay here';
    document.getElementById('drop-sub').textContent = '.txt · .docx · .pdf supported · max 50 pages';
  }

  function loadSample() {
    document.getElementById('essay-text').value = SAMPLE_TEXT;
    document.getElementById('prompt-text').value = SAMPLE_PROMPT;
    selectedFile = null;
    showReadyState('Sample Essay', 'AI in Higher Education · pasted text');
  }

  function getEnabledLayers() {
    const chipLabels = ['L0–L5 Core', 'L6 Situation', 'L7 RST', 'L8 Argumentation', 'L9 Stance', 'L10 Affect', 'L11 Reader-adaptive'];
    const chips = document.querySelectorAll('.opt-chip');
    const enabled = new Set();

    chips.forEach((chip, i) => {
      if (chip.classList.contains('on')) {
        if (i === 0) {
          // L0-L5 Core (Surface, Lexical, Syntactic, Referential, Semantic, Connective)
          ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'].forEach(id => enabled.add(id));
        } else {
          const id = chipLabels[i].split(' ')[0];
          enabled.add(id);
        }
      }
    });

    return [...enabled];
  }

  function startAnalysisFromReady() {
    // Copy prompt and genre from ready section to main fields
    const readyPrompt = document.getElementById('ready-prompt');
    const readyGenre = document.getElementById('ready-genre');
    if (readyPrompt) document.getElementById('prompt-text').value = readyPrompt.value;
    if (readyGenre) document.getElementById('genre-select').value = readyGenre.value;
    startAnalysis();
  }

  async function startAnalysis() {
    const essayText = document.getElementById('essay-text').value.trim();
    const promptText = document.getElementById('prompt-text').value.trim();
    const learnerId = document.getElementById('learner-id')?.value?.trim() || '';
    const enabledLayers = getEnabledLayers();

    if (!essayText && !selectedFile) {
      alert('Please enter essay text or upload a file.');
      return;
    }

    // Switch to processing screen
    App.showScreen('process');
    App.enableNav('btn-process');

    // Save to library if checkbox is checked and a file was uploaded
    const saveToLib = document.getElementById('save-to-library')?.checked;
    if (saveToLib && selectedFile) {
      Library.saveFileToLibrary(selectedFile);
    }

    // Build form data
    const formData = new FormData();
    if (selectedFile) {
      formData.append('file', selectedFile);
    }
    formData.append('text', essayText);
    formData.append('promptText', promptText);
    formData.append('learnerId', learnerId);
    formData.append('enabledLayers', JSON.stringify(enabledLayers));
    formData.append('genre', document.getElementById('genre-select')?.value || '');

    Processing.start(formData);
  }

  return { init, loadSample, showBrowseState };
})();
