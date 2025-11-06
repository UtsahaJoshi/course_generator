import React, { useRef, useState } from 'react';
import axios from 'axios';
import './App.css';
import CourseHeader from './components/CourseHeader';
import PromptInput from './components/PromptInput';
import LoadingIndicator from './components/LoadingIndicator';
import CourseContent from './components/CourseContent';
import BranchChoices from './components/BranchChoices';

function App() {
  const [promptInput, setPromptInput] = useState('');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [courseData, setCourseData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Navigation history: each node = { key, prompt, data, selectedKey }
  const [history, setHistory] = useState([]);
  // Cache: topicText -> generated JSON (so revisits are instant)
  const cacheRef = useRef(new Map());

  const handleInputChange = (e) => setPromptInput(e.target.value);

  const nodeKeyFor = (text) => text.trim().toLowerCase();

  const setCurrentFromNode = (node) => {
    setCourseData(node.data);
    setErrorMsg('');
  };

  const pushNode = (node) => {
    setHistory((prev) => [...prev, node]);
    setCurrentFromNode(node);
  };

  const buildDeepPrompt = (currentData, fallbackPrompt) => {
    const base =
      (currentData && currentData.course_title) ||
      (history[history.length - 1]?.prompt) ||
      fallbackPrompt ||
      'Quantum computing';
    // Keep same contract: we still send a "text" prompt string
    return `Go deeper on: ${base}. Focus on advanced concepts, technical detail, caveats, and state-of-the-art.`;
  };

  const callBackend = async (text) => {
    const res = await axios.post('http://localhost:5000/generate-course', { text });
    const raw = res.data.content;
    if (raw === 'Not Valid Content') {
      throw new Error('Not Valid Content');
    }
    return JSON.parse(raw);
  };

  // Initial generation from the input prompt
  const generateCourse = async () => {
    setIsFadingOut(true);
    setTimeout(async () => {
      setIsLoading(true);
      setErrorMsg('');
      try {
        const key = nodeKeyFor(promptInput);
        if (cacheRef.current.has(key)) {
          const cached = cacheRef.current.get(key);
          pushNode({ key, prompt: promptInput, data: cached, selectedKey: null });
          return;
        }
        const data = await callBackend(promptInput);
        cacheRef.current.set(key, data);
        pushNode({ key, prompt: promptInput, data, selectedKey: null });
      } catch (err) {
        console.error(err);
        setErrorMsg(err.message || 'Something went wrong generating the course.');
        setCourseData(null);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  };

  // Handling branch choices
  const handleChoiceClick = async (choice) => {
    const text = choice.text;
    const key = nodeKeyFor(text);

    // If cached → switch instantly, record which key was selected on the NEW node
    if (cacheRef.current.has(key)) {
      const cached = cacheRef.current.get(key);
      pushNode({ key, prompt: text, data: cached, selectedKey: null });
      return;
    }

    // Not cached → generate
    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await callBackend(text);
      cacheRef.current.set(key, data);
      // Save *which* choice was used from the previous node (for highlighting on back)
      setHistory((prev) => {
        // mark the current (last) node's selectedKey before pushing new node
        const updated = [...prev];
        if (updated.length > 0) {
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            selectedKey: choice.key, // '1' or '2'
          };
        }
        return updated;
      });
      pushNode({ key, prompt: text, data, selectedKey: null });
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Something went wrong generating the branch.');
    } finally {
      setIsLoading(false);
    }
  };

  // Dig deeper on *current* topic
  const handleDeepClick = async () => {
    const deepText = buildDeepPrompt(courseData, promptInput);
    const key = nodeKeyFor(deepText);

    if (cacheRef.current.has(key)) {
      const cached = cacheRef.current.get(key);
      pushNode({ key, prompt: deepText, data: cached, selectedKey: 'deep' });
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await callBackend(deepText);
      cacheRef.current.set(key, data);
      // Mark the current node as having chosen "deep"
      setHistory((prev) => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            selectedKey: 'deep',
          };
        }
        return updated;
      });
      pushNode({ key, prompt: deepText, data, selectedKey: null });
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Something went wrong generating the deeper dive.');
    } finally {
      setIsLoading(false);
    }
  };

  // Go back to the previous node (instant; no loading)
  const handleBack = () => {
    setIsLoading(false);
    setErrorMsg('');
    setHistory((prev) => {
      if (prev.length <= 1) return prev; // nothing to go back to
      const updated = prev.slice(0, prev.length - 1);
      const last = updated[updated.length - 1];
      setCurrentFromNode(last);
      return updated;
    });
  };

  const showBack = history.length > 1;
  const selectedKeyForCurrentContext =
    history.length > 0 ? history[history.length - 1].selectedKey : null;

  return (
    <div className="app-viewport">
      {!isLoading && !courseData && !errorMsg && (
        <>
          <CourseHeader isFadingOut={isFadingOut} />
          <PromptInput
            isFadingOut={isFadingOut}
            onInputChange={(e) => setPromptInput(e.target.value)}
            onButtonClick={generateCourse}
            promptInput={promptInput}
          />
        </>
      )}

      {isLoading && <LoadingIndicator />}

      {!isLoading && errorMsg && (
        <div className="center-stack">
          <CourseHeader isFadingOut={false} />
          <div className="error-box">
            <p className="error-text">{errorMsg}</p>
            <PromptInput
              isFadingOut={false}
              onInputChange={handleInputChange}
              onButtonClick={generateCourse}
              promptInput={promptInput}
            />
          </div>
        </div>
      )}

      {!isLoading && courseData && (
        <div className="course-layout">
          <CourseHeader isFadingOut={false} />
          <div className="course-panel">
            <CourseContent courseData={courseData} />
            <BranchChoices
              choices={courseData.choices}
              onChoiceClick={handleChoiceClick}
              onDeepClick={handleDeepClick}
              showBack={showBack}
              onBackClick={handleBack}
              selectedKey={selectedKeyForCurrentContext}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
