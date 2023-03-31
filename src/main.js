const { invoke } = window.__TAURI__.tauri;

let chatHistory;
let chatContentInput;
let conversationsDiv;
// Global variable
let curConversationId;
let conversationMap = {};

window.addEventListener("DOMContentLoaded", () => {
  chatHistory = document.getElementById("chat-history")
  chatContentInput = document.getElementById("chat-content")
  conversationsDiv = document.getElementById("conversations");
  chatContentInput.addEventListener("keydown", function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      sendChatContent();
    }
  })
  loadConversationMap();
});

const Role = {
  user: "user",
  assistant: "assistant"
}

// Send content to backend API
function sendChatContent() {
  let content = chatContentInput.value;
  appendMsg(Role.user, content);
  chatContentInput.value = "";
  if (!curConversationId) {
    newConversation(content);
    conversationMap[curConversationId] = [{ role: Role.user, content: content }];
  } else {
    conversationMap[curConversationId].push({ role: Role.user, content: content })
  }
  invoke("send_content", { messages: conversationMap[curConversationId], conversationId: curConversationId })
    .then((res) => {
      if (res.id == curConversationId) {
        appendMsg(Role.assistant, res.content);
      } else {
        document.querySelector("[data-id='" + res.id + "']").classList.add("notify");
      }
      conversationMap[res.id].push({ role: Role.assistant, content: res.content })
      invoke("save_conversations", { conversationMap: JSON.stringify(conversationMap) });
    });
}

async function loadConversationMap() {
  let conversations = await invoke("load_conversations");
  if (!conversations) {
    return;
  }
  let json = JSON.parse(conversations);
  conversationMap = json;
  Object.keys(json).reverse().forEach((key) => {
    const value = json[key];
    conversationsDiv.appendChild(buildTitleNode(key, subTitle(value[0].content)));
  })
}

function loadConversationHistory(conversationId) {
  let history = conversationMap[conversationId];
  history.forEach((val) => {
    chatHistory.appendChild(buildMessageNode(val.role, val.content));
  })
  highlightCode();
}

function highlightCode() {
  hljs.highlightAll();
  let pres = document.querySelectorAll("pre");
  pres.forEach((ele) => {
    if (!ele.querySelector(".copy-code")) {
      let code = ele.getElementsByTagName("code")[0];
      let lan;
      if (code.classList[1].includes("language")) {
        lan = code.classList[1].replace("language-", "");
      } else {
        lan = code.classList[0].replace("language-", "");
      }
      let copyDiv = document.createElement("div");
      copyDiv.innerHTML = "<div class='copy-code two-end'><div>" + lan + "</div><div class='btn'>📄 Copy</div></div>";
      ele.insertBefore(copyDiv, code);
    }
  })
  let clipboard = new ClipboardJS('.copy-code', {
    text: function (trigger) {
      return trigger.parentElement.nextElementSibling;
    }
  });
  clipboard.on('success', function (e) {
    e.trigger.querySelector(".btn").innerHTML = "📋 Copied!"
    e.clearSelection();
    setTimeout(function(){
      e.trigger.querySelector(".btn").innerHTML = "📄 Copy"
    }, 1000);
  });
}

function newConversation(content) {
  curConversationId = new Date().getTime() + "";
  conversationsDiv.insertBefore(buildTitleNode(curConversationId, subTitle(content), true), conversationsDiv.firstChild);
}

function clickConversation(ele) {
  let dataId = ele.getAttribute("data-id");
  clearActiveConversation();
  ele.classList.remove("notify");
  ele.classList.add("active");
  loadConversationHistory(dataId);
  curConversationId = dataId;
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function removeConversation(event) {
  let ele = event.target;
  let dataId = ele.parentElement.getAttribute("data-id");
  if (curConversationId == dataId) {
    clearActiveConversation();
  }
  document.querySelector("[data-id='" + dataId + "']").remove();
  delete conversationMap[dataId];
  invoke("save_conversations", { conversationMap: JSON.stringify(conversationMap) });
  event.stopPropagation();
}

function buildTitleNode(conversationId, title, isActive) {
  let node = document.createElement("div");
  let active = isActive ? "active" : "";
  node.innerHTML = "<div onclick='clickConversation(this)' data-id='" + conversationId + "' class='conversation two-end " + active + "'><div class='raw'><div class='current status'>🟢</div><div class='default status'>⚪</div><div class='notify status'>🟠</div><div class='title'></div></div><div onclick='removeConversation(event)' class='remove btn'>❌</div></div>"
  node.querySelector(".title").innerText = title;
  return node.firstChild;
}

function buildMessageNode(role, content) {
  let node = document.createElement("div");
  if (role == Role.user) {
    node.innerHTML = "<div class='message user-message'><div class='textarea'></div><div class='avatar'></div></div>"
    node.querySelector(".textarea").innerText = content;
  } else if (role == Role.assistant) {
    node.innerHTML = "<div class='message bot-message'><div class='avatar'></div><div class='textarea'>" + content + "</div></div>"
  }
  return node.firstChild;
}

function clearActiveConversation() {
  let activeNode = document.querySelector(".conversation.active")
  activeNode && activeNode.classList.remove("active");
  curConversationId = null;
  chatHistory.innerHTML = "";
}

function appendMsg(role, content) {
  chatHistory.appendChild(buildMessageNode(role, content));
  chatHistory.scrollTop = chatHistory.scrollHeight;
  highlightCode();
}

function subTitle(content) {
  let title;
  if (content.length > 20) {
    title = content.substring(0, 20);
  } else {
    title = content;
  }
  return title;
}
