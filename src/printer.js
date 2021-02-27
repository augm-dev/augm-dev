import kleur from 'kleur'
let { bold, dim } = kleur

export let printer = {
  print(message, color="blue"){
    if(!this.silent){
      console.log(`${kleur[color](`လ`)} ${dim(':')} ${message}`)
    }
  },
  warn(message){
    this.print(message, "yellow")
  },
  error(message, e){
    this.print(message, "red")
  },
  success(message){
    this.print(message, "green")
  },
  info(message){
    this.print(message, "blue")
  },
  benchmarks(arr){
    if(!this.silent){
      if(arr.length){
        console.log(dim("║"))
      }
      arr.forEach(([label, ...facts], i) => {
        console.log(`${i === arr.length - 1 ? dim("╚══") : dim("╟══")} ${label} ${dim("═▷")}  ${facts.join(dim(' -- '))}`)
      });
    }
  },
  silent: false
}