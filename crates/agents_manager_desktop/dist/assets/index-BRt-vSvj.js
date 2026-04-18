(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))l(r);new MutationObserver(r=>{for(const n of r)if(n.type==="childList")for(const c of n.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&l(c)}).observe(document,{childList:!0,subtree:!0});function s(r){const n={};return r.integrity&&(n.integrity=r.integrity),r.referrerPolicy&&(n.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?n.credentials="include":r.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function l(r){if(r.ep)return;r.ep=!0;const n=s(r);fetch(r.href,n)}})();async function i(e,t={},s){return window.__TAURI_INTERNALS__.invoke(e,t,s)}const P={apply:{start:"正在应用到项目",success:"Apply 已完成",error:"Apply 执行失败"},doctor:{start:"正在运行 Doctor",success:"Doctor 已完成",error:"Doctor 执行失败"},refresh:{start:"正在刷新技能库",success:"技能库已刷新",error:"技能库刷新失败"},reloadProfiles:{start:"正在刷新 Profiles",success:"Profiles 已刷新",error:"Profiles 刷新失败"},saveProfile:{start:"正在保存 Profile",success:"Profile 已保存",error:"Profile 保存失败"},pickProject:{start:"正在选择项目目录",success:"项目目录已更新",error:"项目目录选择失败"},bootstrap:{start:"正在加载界面数据",success:"界面已准备就绪",error:"界面初始化失败"}};function A(){return{busy:!1,activeAction:null,statusTone:"idle",statusText:"准备就绪"}}function I(e,t){const s=P[t.action]||{start:"正在处理",success:"操作已完成",error:"操作执行失败"};return t.type==="start"?{...e,busy:!0,activeAction:t.action,statusTone:"working",statusText:s.start}:t.type==="success"?{...e,busy:!1,activeAction:null,statusTone:"success",statusText:s.success}:t.type==="error"?{...e,busy:!1,activeAction:null,statusTone:"error",statusText:s.error}:e}function d(e){return String(e??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}function T(e,t=[]){if(!e.length)return'<div class="skills-empty">未发现可用技能</div>';const s=new Set(t);return e.map(l=>{const r=d(l.id),n=d(l.name||l.id),c=d(l.description||"暂无描述"),b=s.has(l.id)?" checked":"";return`
      <label class="skill-card">
        <input class="skill-checkbox" type="checkbox" data-skill value="${r}"${b} />
        <span class="skill-marker" aria-hidden="true"></span>
        <span class="skill-copy">
          <strong>${n}</strong>
          <small>${c}</small>
        </span>
      </label>
    `}).join("")}function _(e){return e>0?`已选 ${e} 项`:"未选择技能"}function S(e,t="info"){return e instanceof Error?{tone:"error",text:e.message||String(e)}:typeof e=="string"?{tone:t,text:e}:{tone:t,text:JSON.stringify(e,null,2)}}function B(e){const t=[];return e.id||t.push("profile id 不能为空"),e.project_skill_root||t.push("project_skill_root 不能为空"),t}function h(e){return e.project?[]:["project 路径不能为空"]}function j(){return`
    <main class="app-shell">
      <div class="app-backdrop" aria-hidden="true"></div>
      <section class="hero">
        <div>
          <p class="eyebrow">Desktop Workspace</p>
          <h1>agents-manager</h1>
          <p class="hero-copy">管理 Skills / CLAUDE.md / AGENTS.md（GUI + CLI 共用核心）</p>
        </div>
        <div class="status-card" data-role="status" data-tone="idle">
          <span class="status-dot"></span>
          <div>
            <p class="status-label">状态</p>
            <strong id="statusText">准备就绪</strong>
          </div>
        </div>
      </section>

      <section class="workspace">
        <div class="column stack">
          <article class="panel">
            <div class="panel-head">
              <div>
                <p class="panel-kicker">Profiles</p>
                <h2>Profile 配置</h2>
              </div>
            </div>

            <label class="field">
              <span>当前 Profile</span>
              <select id="profile"></select>
            </label>

            <div class="field-grid">
              <label class="field">
                <span>Profile ID</span>
                <input id="profileId" placeholder="e.g. claude" />
              </label>
              <label class="field">
                <span>Skill Root</span>
                <input id="profileSkillRoot" placeholder=".claude/skills" />
              </label>
            </div>

            <div class="field-grid">
              <label class="field">
                <span>CLAUDE.md Target</span>
                <input id="profileClaudeTarget" placeholder="CLAUDE.md" />
              </label>
              <label class="field">
                <span>AGENTS.md Target</span>
                <input id="profileAgentsTarget" placeholder="AGENTS.md" />
              </label>
            </div>

            <div class="button-row">
              <button id="saveProfile" class="secondary">保存/更新 Profile</button>
              <button id="reloadProfiles" class="ghost">刷新 Profiles</button>
            </div>
          </article>

          <article class="panel">
            <div class="panel-head">
              <div>
                <p class="panel-kicker">Project</p>
                <h2>项目与来源</h2>
              </div>
            </div>

            <label class="field">
              <span>Project 路径</span>
              <div class="inline-field">
                <input id="project" value="." />
                <button id="pickProject" class="secondary">选择目录</button>
              </div>
            </label>

            <div class="field-grid">
              <label class="field">
                <span>CLAUDE.md 源文件</span>
                <input id="claudeMd" placeholder="/path/to/CLAUDE.md" />
              </label>
              <label class="field">
                <span>AGENTS.md 源文件</span>
                <input id="agentsMd" placeholder="/path/to/AGENTS.md" />
              </label>
            </div>
          </article>
        </div>

        <div class="column stack">
          <article class="panel">
            <div class="panel-head">
              <div>
                <p class="panel-kicker">Skills</p>
                <h2>可用技能</h2>
              </div>
              <span class="selection-pill" id="skillsCount">未选择技能</span>
            </div>

            <div id="skills" class="skills-grid" data-role="skills"></div>

            <div class="button-row">
              <button id="refresh" class="ghost">刷新库</button>
              <button id="apply" class="primary">应用到项目</button>
              <button id="doctor" class="secondary">运行 doctor</button>
            </div>
          </article>

          <article class="panel output-panel">
            <div class="panel-head">
              <div>
                <p class="panel-kicker">Output</p>
                <h2>执行结果</h2>
              </div>
            </div>
            <pre id="output" class="output-console" data-role="output" data-tone="info">等待操作…</pre>
          </article>
        </div>
      </section>
    </main>
  `}const E=document.getElementById("app"),L=["refresh","reloadProfiles","pickProject","saveProfile","apply","doctor"],w={refresh:"刷新中…",reloadProfiles:"同步中…",pickProject:"选择中…",saveProfile:"保存中…",apply:"应用中…",doctor:"执行中…"},a={action:A()};function C(){E.innerHTML=j()}function k(){const e=document.querySelector('[data-role="status"]'),t=document.getElementById("statusText");e.dataset.tone=a.action.statusTone,t.textContent=a.action.statusText,L.forEach(s=>{var n;const l=document.getElementById(s);if(!l)return;(n=l.dataset).label||(n.label=l.textContent);const r=a.action.busy&&a.action.activeAction===s;l.disabled=a.action.busy,l.classList.toggle("is-busy",r),l.textContent=r?w[s]||"处理中…":l.dataset.label})}function u(e){a.action=I(a.action,e),k()}function y(){return[...document.querySelectorAll("input[data-skill]:checked")].map(e=>e.value)}function p(){document.getElementById("skillsCount").textContent=_(y().length)}function v(e,t="info"){const s=document.getElementById("output"),l=S(e,t);s.dataset.tone=l.tone,s.textContent=l.text,s.scrollTop=0}async function o(e,t){u({type:"start",action:e});try{const s=await t();return u({type:"success",action:e}),s!=null&&v(s,"success"),s}catch(s){return u({type:"error",action:e}),v(s,"error"),null}}function f(e){document.getElementById("profileId").value=(e==null?void 0:e.id)||"",document.getElementById("profileSkillRoot").value=(e==null?void 0:e.project_skill_root)||"",document.getElementById("profileClaudeTarget").value=(e==null?void 0:e.claude_md_target)||"CLAUDE.md",document.getElementById("profileAgentsTarget").value=(e==null?void 0:e.agents_md_target)||"AGENTS.md"}async function m(){const e=await i("list_profiles_cmd"),t=document.getElementById("profile"),s=t.value;t.innerHTML=e.map(r=>`<option value="${r.id}">${r.id}</option>`).join("");const l=e.find(r=>r.id===s)||e[0];l&&(t.value=l.id,f(l)),t.onchange=()=>{const r=e.find(n=>n.id===t.value);f(r)}}async function g(){const e=y(),t=await i("scan_library_cmd"),s=document.getElementById("skills");s.innerHTML=T(t,e),p()}async function x(){const e={project:document.getElementById("project").value,profile:document.getElementById("profile").value,skills:y(),claude_md:document.getElementById("claudeMd").value||null,agents_md:document.getElementById("agentsMd").value||null,mode:"symlink"},t=h(e);if(t.length>0)throw new Error(t.join(`
`));return i("apply_cmd",{req:e})}async function N(){const e=document.getElementById("project").value,t=document.getElementById("profile").value,s=h({project:e});if(s.length>0)throw new Error(s.join(`
`));return i("doctor_cmd",{project:e,profile:t})}async function D(){const e=await i("pick_project_dir_cmd");e&&(document.getElementById("project").value=e)}async function O(){const e={id:document.getElementById("profileId").value.trim(),project_skill_root:document.getElementById("profileSkillRoot").value.trim(),claude_md_target:document.getElementById("profileClaudeTarget").value.trim()||"CLAUDE.md",agents_md_target:document.getElementById("profileAgentsTarget").value.trim()||"AGENTS.md"},t=B(e);if(t.length>0)throw new Error(t.join(`
`));const s=await i("save_profile_cmd",{req:e});return await m(),document.getElementById("profile").value=s.id,f(s),s}async function U(){C(),k(),p(),await o("bootstrap",async()=>{await m(),await g()}),document.getElementById("skills").addEventListener("change",e=>{e.target.matches("input[data-skill]")&&p()}),document.getElementById("refresh").addEventListener("click",()=>o("refresh",g)),document.getElementById("reloadProfiles").addEventListener("click",()=>o("reloadProfiles",m)),document.getElementById("pickProject").addEventListener("click",()=>o("pickProject",D)),document.getElementById("saveProfile").addEventListener("click",()=>o("saveProfile",O)),document.getElementById("apply").addEventListener("click",()=>o("apply",x)),document.getElementById("doctor").addEventListener("click",()=>o("doctor",N))}U().catch(e=>{E.textContent=String(e)});
