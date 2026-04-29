// const age=15;//数字
// const title="起风了";//字符串
// const isPlaying=true;//布尔值
// const nothing=null;//空值


//字符串的模板语法
const name="小明";
const age=18;

const msg1="我叫"+name+",今年"+age+"岁了。";
console.log(msg1);

const msg2=`我叫${name},今年${age}岁了。`;
console.log(msg2);

//反引号里${}中可以放任何表达式
const price=99;
const text="总价:${price*1.1}";
console.log(text);

//数组：有序列表
const fruits=["苹果","香蕉","橘子"];
console.log(fruits[0]);//访问数组元素
console.log(fruits.length);//数组长度
fruits.push("葡萄");//向数组末尾添加元素
console.log(fruits);

console.log(fruits.pop());//从数组末尾删除元素
console.log(fruits);

console.log(fruits.includes("香蕉"));//检查数组是否包含某个元素

//最长用的三个数组方法
const nums=[1,2,3,4,5];

//map：对数组每个元素进行转换，返回一个新数组
const squares=nums.map(x=>x*x);
console.log(squares);

//filter：过滤数组元素，返回一个新数组
const evens=nums.filter(x=>x%2===0);
console.log(evens);

//reduce：对数组进行累积计算，返回一个值
const sum=nums.reduce((acc,x)=>acc+x,0);
console.log(sum);
//找到第一个满足条件的
const firstEven=nums.find(x=>x%2===0);
console.log(firstEven);

//遍历数组
for (const fruit of fruits){
    console.log(fruit);
}

//对象：键值对的集合
// const song={
//     id:1,
//     title:"起风了",
//     artist:"买辣椒也用券",
//     duration:321,
//     isLiked:true
// };
// console.log(song.title);
// console.log(song)

//快速提取字段
const song={
    id:1,
    title:"起风了",
    artist:"买辣椒也用券",
};

//解构赋值
const {id,title}=song;

const {artist:singer}=song;
console.log(id,title,singer);


//展开运算符...
const a=[1,2,3];
const b=[...a,4,5];//[1,2,3,4,5]
console.log(b);

const song1={id:1,title:"A"};
const song2={...song1,title:"B"};//{id:1,title:"A"}
console.log(song2);

//函数：可复用的代码块
//函数声明
function add(x,y){
    return x+y;
}

//函数表达式
const multiply=function(x,y){
    return x*y;
};

//箭头函数
const subtract=(x,y)=>x-y;

console.log(add(2,3));
console.log(multiply(2,3));
console.log(subtract(2,3));

//默认参数
function applyTwice(fn,x){
    return fn(fn(x));
}
//console.log(applyTwice(x=>x+1,5));//7