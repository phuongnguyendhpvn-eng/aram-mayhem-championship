import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PASTE_") && SUPABASE_ANON_KEY.length > 30 && !SUPABASE_ANON_KEY.includes("PASTE_");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = (id) => document.getElementById(id);
let players = [], teams = [], matches = [], session = null, toastTimer;

const teamColors = ["#a77aff", "#ed6be8", "#58dff5"];
const teamFallback = ["ĐỘI TÍM", "ĐỘI HỒNG", "ĐỘI XANH"];

function notify(message, error=false) {
  const el=$("toast"); el.textContent=message; el.classList.remove("hidden","error");
  if(error) el.classList.add("error"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.add("hidden"),3200);
}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function teamName(id){return teams.find(t=>t.id===id)?.name || "Chưa xác định";}
function playerTeamName(p){return p.team_id ? teamName(p.team_id) : "CHƯA CHIA ĐỘI";}
function setNav(){document.querySelectorAll("[data-nav]").forEach(a=>a.classList.toggle("active",a.getAttribute("href")===location.hash || (!location.hash&&a.dataset.nav==="home")));}

async function loadAll(showLoading=true){
  if(!supabase){renderSetupNotice();return;}
  try{
    const [p,t,m]=await Promise.all([
      supabase.from("players").select("*").order("created_at"),
      supabase.from("teams").select("*").order("sort_order"),
      supabase.from("matches").select("*").order("match_no")
    ]);
    if(p.error) throw p.error;if(t.error) throw t.error;if(m.error) throw m.error;
    players=p.data||[];teams=t.data||[];matches=m.data||[];
    renderAll();
  }catch(e){console.error(e);if(showLoading)notify("Chưa thể tải dữ liệu. Kiểm tra cấu hình Supabase và SQL.",true);}
}
function renderSetupNotice(){
  ["team-cards","player-list","match-list","ranking-body"].forEach(id=>{const el=$(id);if(el)el.innerHTML=`<div class="empty-state">Website đang chờ kết nối cơ sở dữ liệu. Bro hãy làm theo file README_SETUP.md.</div>`;});
  $("player-count").textContent="CHƯA KẾT NỐI DATABASE";
}
function renderAll(){renderTeams();renderPlayers();renderMatches();renderRanking();if(session)renderAdmin();}
function renderTeams(){
  const el=$("team-cards");
  if(!teams.length){el.innerHTML='<div class="empty-state">Chưa có đội tuyển. Admin hãy bốc thăm để tạo 3 đội.</div>';return;}
  el.innerHTML=teams.map((t,i)=>{const roster=players.filter(p=>p.team_id===t.id);return `<article class="team-card" data-index="0${i+1}" style="border-top-color:${teamColors[i%3]}"><h3>${esc(t.name)}</h3><div class="team-sub">TEAM 0${i+1} / ${roster.length} PLAYERS</div><ul>${roster.length?roster.map((p,j)=>`<li><span>0${j+1}</span>${esc(p.name)}</li>`).join(""):'<li>Chưa có thành viên</li>'}</ul></article>`;}).join("");
}
function renderPlayers(){
  const q=($("player-search").value||"").toLocaleLowerCase("vi");
  const list=players.filter(p=>p.name.toLocaleLowerCase("vi").includes(q));
  $("player-count").textContent=`${players.length} / 15 PLAYERS`;
  $("player-list").innerHTML=list.length?list.map(p=>`<article class="player-card"><div class="player-avatar">${esc(p.name.trim().charAt(0).toUpperCase())}</div><div><strong>${esc(p.name)}</strong><small>${esc(playerTeamName(p))}</small></div></article>`).join(""):'<div class="empty-state">Không tìm thấy tuyển thủ.</div>';
}
function renderMatches(){
  const el=$("match-list");
  if(!matches.length){el.innerHTML='<div class="empty-state">Chưa có lịch thi đấu. Admin hãy khởi tạo 3 đội và lịch đấu.</div>';return;}
  el.innerHTML=matches.map(m=>{const a=teamName(m.team_a_id),b=teamName(m.team_b_id),done=!!m.winner_team_id;return `<article class="match-card"><div class="match-number">0${m.match_no}<small>ROUND 01</small></div><div class="match-versus"><div class="match-team">${esc(a)}</div><div class="vs">VS</div><div class="match-team">${esc(b)}</div></div><div class="match-status ${done?'done':''}">${done?`WINNER: ${esc(teamName(m.winner_team_id))}`:"UPCOMING / BO1"}</div></article>`;}).join("");
}
function computeStandings(){
  const rows=teams.map(t=>({id:t.id,name:t.name,played:0,wins:0,losses:0,diff:0,points:0,opponents:{}}));
  const byId=Object.fromEntries(rows.map(r=>[r.id,r]));
  matches.filter(m=>m.winner_team_id).forEach(m=>{
    const a=byId[m.team_a_id],b=byId[m.team_b_id],w=byId[m.winner_team_id];if(!a||!b||!w)return;
    const l=w.id===a.id?b:a;a.played++;b.played++;w.wins++;w.points+=3;l.losses++;a.opponents[b.id]=w.id===a.id?1:0;b.opponents[a.id]=w.id===b.id?1:0;
  });
  rows.forEach(r=>r.diff=r.wins-r.losses);
  // Xếp theo điểm; trong nhóm bằng điểm, tính điểm đối đầu riêng giữa các đội cùng nhóm.
  const pointGroups = [...new Set(rows.map(r=>r.points))].sort((a,b)=>b-a);
  const sorted = [];
  for (const pts of pointGroups) {
    const group = rows.filter(r=>r.points===pts);
    const ids = new Set(group.map(r=>r.id));
    const mini = Object.fromEntries(group.map(r=>[r.id,0]));
    for (const m of matches.filter(m=>m.winner_team_id && ids.has(m.team_a_id) && ids.has(m.team_b_id))) {
      mini[m.winner_team_id] = (mini[m.winner_team_id] || 0) + 3;
    }
    group.sort((a,b)=>(mini[b.id]||0)-(mini[a.id]||0) || b.diff-a.diff || a.name.localeCompare(b.name,"vi"));
    sorted.push(...group);
  }
  return sorted;
}
function renderRanking(){
  const rows=computeStandings();
  $("ranking-body").innerHTML=rows.length?rows.map((r,i)=>`<tr><td>${String(i+1).padStart(2,"0")}</td><td>${esc(r.name)}</td><td>${r.played}</td><td>${r.wins}</td><td>${r.losses}</td><td>${r.diff>0?"+":""}${r.diff}</td><td class="points">${r.points}</td></tr>`).join(""):'<tr><td colspan="7" class="empty-state">Chưa có dữ liệu bảng xếp hạng.</td></tr>';
  const played=matches.filter(m=>m.winner_team_id).length;
  const banner=$("champion-banner");
  if(matches.length===3&&played===3&&rows.length){banner.innerHTML=`<div class="eyebrow">THE CHAMPIONS / SEASON 01</div><h2>${esc(rows[0].name.toUpperCase())}<br><em>CLAIM THE CROWN.</em></h2><p>Vô địch với ${rows[0].points} điểm sau ${played} trận. Congratulations!</p>`;}
  else banner.innerHTML='<div class="eyebrow">THE FINAL DESTINATION</div><h2>WHO WILL<br><em>RISE ABOVE?</em></h2><p>Every battle writes a story. Only one team claims the crown.</p>';
}

async function requireAdmin(){if(!session)throw new Error("Phiên đăng nhập Admin đã hết hạn.");}
async function adminAction(promise){const {error}=await promise;if(error)throw error;await loadAll(false);notify("Đã lưu thay đổi.");}
function renderAdmin(){
  $("admin-identity").textContent=session?.user?.email||"ADMIN";
  $("admin-player-list").innerHTML=players.length?players.map(p=>`<div class="admin-row"><input class="admin-input" data-player-name="${p.id}" value="${esc(p.name)}" maxlength="40"><div class="admin-actions"><button class="mini-btn" data-save-player="${p.id}">LƯU</button><button class="mini-btn danger" data-delete-player="${p.id}">XÓA</button></div></div>`).join(""):'<p class="hint">Chưa có tuyển thủ.</p>';
  $("admin-team-list").innerHTML=teams.length?teams.map((t,i)=>`<div class="admin-row"><input class="admin-input" data-team-name="${t.id}" value="${esc(t.name)}" maxlength="40"><div class="admin-actions"><button class="mini-btn" data-save-team="${t.id}">LƯU TÊN ĐỘI</button><span class="hint">${players.filter(p=>p.team_id===t.id).length}/5 thành viên</span></div></div>`).join(""):'<p class="hint">Chưa có đội. Hãy bốc thăm trước.</p>';
  $("admin-match-list").innerHTML=matches.length?matches.map(m=>`<div class="admin-match"><div><b>TRẬN 0${m.match_no}:</b> ${esc(teamName(m.team_a_id))} vs ${esc(teamName(m.team_b_id))}</div><select class="admin-select" data-match-winner="${m.id}"><option value="">Chưa có kết quả</option><option value="${m.team_a_id}" ${m.winner_team_id===m.team_a_id?"selected":""}>Thắng: ${esc(teamName(m.team_a_id))}</option><option value="${m.team_b_id}" ${m.winner_team_id===m.team_b_id?"selected":""}>Thắng: ${esc(teamName(m.team_b_id))}</option></select></div>`).join(""):'<p class="hint">Chưa có lịch. Hãy bốc thăm để khởi tạo lịch 3 trận.</p>';
}
async function drawTeams(){
  await requireAdmin();
  if(players.length!==15)throw new Error(`Cần đúng 15 tuyển thủ trước khi bốc thăm. Hiện có ${players.length}.`);
  const names=["ĐỘI TÍM","ĐỘI HỒNG","ĐỘI XANH"];
  let existing=[...teams].sort((a,b)=>a.sort_order-b.sort_order);
  if(existing.length!==3){
    const ins=await supabase.from("teams").insert(names.map((name,i)=>({name,sort_order:i+1}))).select();
    if(ins.error)throw ins.error;existing=ins.data;
  }
  const shuffled=[...players].sort(()=>Math.random()-.5);
  for(let i=0;i<3;i++){
    const {error}=await supabase.from("teams").update({name:names[i],sort_order:i+1}).eq("id",existing[i].id);if(error)throw error;
  }
  for(let i=0;i<15;i++){
    const {error}=await supabase.from("players").update({team_id:existing[Math.floor(i/5)].id}).eq("id",shuffled[i].id);if(error)throw error;
  }
  const schedule=[{match_no:1,a:existing[0].id,b:existing[1].id},{match_no:2,a:existing[1].id,b:existing[2].id},{match_no:3,a:existing[2].id,b:existing[0].id}];
  const del=await supabase.from("matches").delete().gte("match_no",1);if(del.error)throw del.error;
  const ins=await supabase.from("matches").insert(schedule.map(s=>({match_no:s.match_no,team_a_id:s.a,team_b_id:s.b})));if(ins.error)throw ins.error;
  await loadAll(false);$("draw-status").textContent="Đã bốc thăm thành công và tạo lịch 3 trận BO1.";notify("Bốc thăm thành công!");
}

$("admin-open").addEventListener("click",()=>{if(session){$("admin-panel").classList.toggle("hidden");$("admin-panel").scrollIntoView({behavior:"smooth"});}else $("admin-modal").classList.remove("hidden");});
$("admin-modal").addEventListener("click",e=>{if(e.target.dataset.close)$("admin-modal").classList.add("hidden");});
$("login-form").addEventListener("submit",async e=>{
  e.preventDefault();$("login-error").textContent="";
  if(!supabase){$("login-error").textContent="Chưa cấu hình Supabase. Xem README_SETUP.md.";return;}
  const {data,error}=await supabase.auth.signInWithPassword({email:$("admin-email").value.trim(),password:$("admin-password").value});
  if(error){$("login-error").textContent="Đăng nhập thất bại. Kiểm tra email/mật khẩu hoặc quyền Admin.";return;}
  session=data.session;$("admin-modal").classList.add("hidden");$("admin-panel").classList.remove("hidden");await renderAdmin();$("admin-panel").scrollIntoView({behavior:"smooth"});notify("Đăng nhập Admin thành công.");
});
$("logout").addEventListener("click",async()=>{await supabase.auth.signOut();session=null;$("admin-panel").classList.add("hidden");notify("Đã đăng xuất.");});
$("player-search").addEventListener("input",renderPlayers);
$("add-player-form").addEventListener("submit",async e=>{
  e.preventDefault();try{await requireAdmin();const name=$("new-player-name").value.trim();if(!name)return;if(players.length>=15)throw new Error("Đã đủ 15 tuyển thủ.");await adminAction(supabase.from("players").insert({name}));$("new-player-name").value="";}catch(err){notify(err.message,true);}
});
$("admin-player-list").addEventListener("click",async e=>{
  try{await requireAdmin();const save=e.target.closest("[data-save-player]"),del=e.target.closest("[data-delete-player]");
    if(save){const id=save.dataset.savePlayer,name=document.querySelector(`[data-player-name="${id}"]`).value.trim();if(!name)throw new Error("Tên không được để trống.");await adminAction(supabase.from("players").update({name}).eq("id",id));}
    if(del){if(!confirm("Xóa tuyển thủ này?"))return;await adminAction(supabase.from("players").delete().eq("id",del.dataset.deletePlayer));}
  }catch(err){notify(err.message,true);}
});
$("admin-team-list").addEventListener("click",async e=>{const b=e.target.closest("[data-save-team]");if(!b)return;try{await requireAdmin();const id=b.dataset.saveTeam,name=document.querySelector(`[data-team-name="${id}"]`).value.trim();if(!name)throw new Error("Tên đội không được để trống.");await adminAction(supabase.from("teams").update({name}).eq("id",id));}catch(err){notify(err.message,true);}});
$("admin-match-list").addEventListener("change",async e=>{const s=e.target.closest("[data-match-winner]");if(!s)return;try{await requireAdmin();await adminAction(supabase.from("matches").update({winner_team_id:s.value||null}).eq("id",s.dataset.matchWinner));}catch(err){notify(err.message,true);}});
$("draw-teams").addEventListener("click",async()=>{try{if(!confirm("Bốc thăm sẽ chia lại đội và xóa kết quả 3 trận hiện tại. Tiếp tục?"))return;await drawTeams();}catch(err){notify(err.message,true);}});
document.querySelectorAll(".admin-tabs button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".admin-tabs button").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".admin-tab").forEach(x=>x.classList.toggle("hidden",x.id!==b.dataset.tab));}));
$("mobile-menu").addEventListener("click",()=>{const nav=document.querySelector(".desktop-nav");nav.classList.toggle("mobile-nav");nav.style.display=nav.style.display==="flex"?"none":"flex";nav.style.position="absolute";nav.style.top="78px";nav.style.left="0";nav.style.right="0";nav.style.padding="20px";nav.style.background="#11111d";nav.style.flexDirection="column";});
window.addEventListener("hashchange",setNav);setNav();

async function init(){
  if(!supabase){renderSetupNotice();return;}
  const {data}=await supabase.auth.getSession();session=data.session;
  if(session){const {data:allowed}=await supabase.rpc("is_admin");if(allowed){$("admin-panel").classList.remove("hidden");renderAdmin();}else{await supabase.auth.signOut();session=null;}}
  await loadAll();
  supabase.channel("public-tournament")
    .on("postgres_changes",{event:"*",schema:"public",table:"players"},()=>loadAll(false))
    .on("postgres_changes",{event:"*",schema:"public",table:"teams"},()=>loadAll(false))
    .on("postgres_changes",{event:"*",schema:"public",table:"matches"},()=>loadAll(false))
    .subscribe();
  supabase.auth.onAuthStateChange((_event,s)=>{session=s;});
}
init();
