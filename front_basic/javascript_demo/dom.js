<h1 id="title">原文字</h1>
<button id="btn">点我</button>
<ul id="list"></ul>

<script>
  // 找元素
  const title = document.getElementById("title");
  const btn = document.getElementById("btn");
  const list = document.getElementById("list");

  // 改内容
  title.textContent = "新文字";

  // 改样式
  title.style.color = "red";
  title.style.fontSize = "30px";

  // 加类
  title.classList.add("active");
  title.classList.remove("active");
  title.classList.toggle("active");

  // 监听点击
  btn.addEventListener("click", () => {
    // 动态生成一个 <li> 加进列表
    const li = document.createElement("li");
    li.textContent = "新的一项 " + Math.random();
    list.appendChild(li);
  });
</script>
